import { deflateSync } from 'node:zlib';

type Request = { query?: { size?: string; maskable?: string } };
type Response = { setHeader(name:string,value:string):void; status(code:number):{send(body:Buffer):void} };

function crc32(data:Buffer):number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit=0;bit<8;bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type:string,data:Buffer):Buffer {
  const name=Buffer.from(type);
  const body=Buffer.concat([name,data]);
  const head=Buffer.alloc(4); head.writeUInt32BE(data.length);
  const tail=Buffer.alloc(4); tail.writeUInt32BE(crc32(body));
  return Buffer.concat([head,body,tail]);
}
function line(data:Buffer,size:number,a:[number,number],b:[number,number],thickness:number) {
  const scale=size/512, radius=thickness*scale/2;
  const ax=a[0]*scale, ay=a[1]*scale, bx=b[0]*scale, by=b[1]*scale;
  const minX=Math.max(0,Math.floor(Math.min(ax,bx)-radius-1)), maxX=Math.min(size-1,Math.ceil(Math.max(ax,bx)+radius+1));
  const minY=Math.max(0,Math.floor(Math.min(ay,by)-radius-1)), maxY=Math.min(size-1,Math.ceil(Math.max(ay,by)+radius+1));
  const dx=bx-ax,dy=by-ay,len=dx*dx+dy*dy;
  for(let y=minY;y<=maxY;y++) for(let x=minX;x<=maxX;x++) {
    const t=len===0?0:Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/len));
    const px=ax+t*dx,py=ay+t*dy;
    if((x-px)*(x-px)+(y-py)*(y-py)<=radius*radius) {
      const i=(y*size+x)*4; data[i]=255;data[i+1]=255;data[i+2]=255;data[i+3]=255;
    }
  }
}
function render(size:number,maskable:boolean):Buffer {
  const pixels=Buffer.alloc(size*size*4);
  const bg=[10,15,30,255];
  for(let i=0;i<pixels.length;i+=4){pixels[i]=bg[0];pixels[i+1]=bg[1];pixels[i+2]=bg[2];pixels[i+3]=bg[3];}
  const fit=maskable?.72:1;
  const p=(x:number,y:number):[number,number]=>[256+(x-256)*fit,256+(y-256)*fit];
  const segments:[[number,number],[number,number],number][]=[
    [[78,270],[112,234],18],[[112,234],[160,227],18],[[160,227],[208,227],18],
    [[208,227],[244,203],18],[[244,203],[282,201],18],[[282,201],[314,213],18],
    [[314,213],[372,252],18],[[372,252],[402,257],18],[[102,278],[402,278],14]
  ];
  for(const [a,b,w] of segments) line(pixels,size,p(...a),p(...b),w);
  const row=Buffer.alloc((size*4+1)*size);
  for(let y=0;y<size;y++) pixels.copy(row,y*(size*4+1)+1,y*size*4,(y+1)*size*4);
  const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(size,0);ihdr.writeUInt32BE(size,4);ihdr[8]=8;ihdr[9]=6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',deflateSync(row)),chunk('IEND',Buffer.alloc(0))]);
}
export default function handler(request:Request,response:Response):void {
  const requested=Number(request.query?.size||512);
  const size=[180,192,512].includes(requested)?requested:512;
  const png=render(size,request.query?.maskable==='1');
  response.setHeader('Content-Type','image/png');
  response.setHeader('Cache-Control','public, max-age=31536000, immutable');
  response.status(200).send(png);
}
