import React from 'react';
import { ShareSheet } from './ShareSheet';
export interface ShareModalProps { isOpen:boolean; onClose:()=>void; title:string; url:string; description?:string; dealershipId?:string; }
export const ShareModal:React.FC<ShareModalProps> = props => <ShareSheet {...props}/>;
