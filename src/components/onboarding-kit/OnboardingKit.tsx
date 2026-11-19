import React, { useEffect, useRef } from 'react';
import { ArrowLeft, Check } from 'lucide-react';
import { name } from '../../config/brand';
import './OnboardingKit.css';

export function QuestionScreen(props: {
  children: React.ReactNode; step: number; total: number; heading: string; subtext?: string;
  onBack?: () => void; onContinue: () => void; canContinue: boolean; continueLabel?: string;
  error?: string; busy?: boolean; footerSecondary?: React.ReactNode;
}) {
  const {children,step,total,heading,subtext,onBack,onContinue,canContinue,continueLabel='Continue',error,busy=false,footerSecondary}=props;
  return <main className={"lotle-kit-screen lotle-start"+(step===0?" is-welcome":"")}>
    <header className={"lotle-kit-header"+(step===0?" is-welcome":"")}>
      {step===0?<span className="lotle-kit-brand">{name}</span>:<><button className="lotle-kit-back" type="button" onClick={onBack || (()=>undefined)} disabled={!onBack} aria-label="Go back"><ArrowLeft size={19}/></button><div className="lotle-kit-progress" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={step} aria-label={'Step '+step+' of '+total}><span style={{width:Math.max(0,Math.min(100,step/total*100))+'%'}}/></div><span className="lotle-kit-brand">{name}</span></>}
    </header>
    <section className="lotle-kit-content">
      <div className="lotle-kit-copy"><h1>{heading}</h1>{subtext&&<p>{subtext}</p>}</div>
      {children}
      <p className="lotle-kit-error" role="alert" aria-live="polite">{error||''}</p>
    </section>
    <footer className="lotle-kit-footer"><div className="lotle-kit-footer-fade"/><button className="lotle-kit-continue" type="button" onClick={onContinue} disabled={!canContinue||busy}>{busy?'Please wait…':continueLabel}</button>{footerSecondary&&<div className="lotle-kit-footer-secondary">{footerSecondary}</div>}</footer>
  </main>;
}

export function AnswerCard({label,sublabel,icon,selected,onClick,multi=false}: {
  label:string; sublabel?:string; icon?:React.ReactNode; selected:boolean; onClick:()=>void; multi?:boolean;
}) {
  return <button type="button" className={'lotle-answer-card'+(selected?' is-selected':'')} role={multi?'checkbox':'radio'} aria-checked={selected} onClick={onClick}>
    <span className="lotle-answer-icon" aria-hidden="true">{icon}</span>
    <span className="lotle-answer-copy"><strong>{label}</strong>{sublabel&&<small>{sublabel}</small>}</span>
    <span className={'lotle-answer-radio'+(selected?' is-checked':'')} aria-hidden="true">{selected&&<Check size={13}/>}</span>
  </button>;
}

export function SegmentedToggle<T extends string>({options,value,onChange,label}: {
  options:{value:T;label:string}[];value:T;onChange:(value:T)=>void;label?:string;
}) {
  return <div className="lotle-segmented" role="group" aria-label={label||'Choose an option'}>
    {options.map(option=><button key={option.value} type="button" aria-pressed={value===option.value} className={value===option.value?'is-active':''} onClick={()=>onChange(option.value)}>{option.label}</button>)}
  </div>;
}

export function WheelPicker({label,options,value,onChange}: {
  label:string;options:string[];value:string;onChange:(value:string)=>void;
}) {
  const listRef=useRef<HTMLDivElement>(null);const scrollTimer=useRef<number|null>(null);
  useEffect(()=>{listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({block:'center',behavior:'auto'});},[value]);
  useEffect(()=>()=>{if(scrollTimer.current!==null)window.clearTimeout(scrollTimer.current);},[]);
  return <section className="lotle-wheel-wrap" aria-label={label}><h2>{label}</h2><div className="lotle-wheel"><div className="lotle-wheel-band"/><div className="lotle-wheel-list" ref={listRef} role="listbox" aria-label={label} onScroll={event=>{const list=event.currentTarget;if(scrollTimer.current!==null)window.clearTimeout(scrollTimer.current);scrollTimer.current=window.setTimeout(()=>{const centre=list.getBoundingClientRect().top+list.clientHeight/2;const nearest=Array.from(list.querySelectorAll<HTMLElement>('[role="option"]')).sort((a,b)=>{const rectA=a.getBoundingClientRect();const rectB=b.getBoundingClientRect();return Math.abs(rectA.top+rectA.height/2-centre)-Math.abs(rectB.top+rectB.height/2-centre);})[0];const nextValue=nearest?.textContent||"";if(nextValue&&nextValue!==value)onChange(nextValue);},80);}}>
    {options.map(option=><button key={option} type="button" role="option" aria-selected={value===option} className={value===option?'is-selected':''} onClick={()=>onChange(option)}>{option}</button>)}
  </div></div></section>;
}

export function TextField({label,value,onChange,placeholder,type='text',autoComplete,inputMode,hint}: {
  label:string;value:string;onChange:(value:string)=>void;placeholder?:string;type?:string;autoComplete?:string;
  inputMode?:React.HTMLAttributes<HTMLInputElement>['inputMode'];hint?:string;
}) {
  return <label className="lotle-text-field"><span>{label}</span><input type={type} value={value} onChange={event=>onChange(event.target.value)} placeholder={placeholder} autoComplete={autoComplete} inputMode={inputMode}/>{hint&&<small>{hint}</small>}</label>;
}

export function InsightCard() {
  return <div className="lotle-insight-card">
    <div className="lotle-insight-node"><span>01</span><strong>Your vehicles</strong><small>One place for your stock</small></div><div className="lotle-insight-connector"/>
    <div className="lotle-insight-node"><span>02</span><strong>Your showroom</strong><small>A link buyers can open</small></div><div className="lotle-insight-connector"/>
    <div className="lotle-insight-node"><span>03</span><strong>Buyer enquiries</strong><small>Conversations in one place</small></div>
  </div>;
}
