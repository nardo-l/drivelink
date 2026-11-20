import React,{useEffect,useState} from 'react';
import {Check} from 'lucide-react';
import {Logo} from '../common/Logo';
import './StartTransitionLoading.css';
export type StartSetupPhase='idle'|'creating-account'|'saving-answers'|'creating-showroom'|'saving-settings'|'failed'|'needs-sign-in';
const steps=[{id:'creating-account',label:'Creating your account'},{id:'saving-answers',label:'Preparing your account and saving your answers'},{id:'creating-showroom',label:'Reserving your link and building your showroom'},{id:'saving-settings',label:'Saving your settings'}] as const;
type Props={phase?:StartSetupPhase;startedAt?:number;error?:string;onRetry?:()=>void;onBack?:()=>void;onSignIn?:()=>void};
export const StartTransitionLoading:React.FC<Props>=({phase='idle',startedAt,error='',onRetry,onBack,onSignIn})=>{
 const [slow,setSlow]=useState(false);
 useEffect(()=>{const remaining=Math.max(0,10000-(Date.now()-(startedAt||Date.now())));setSlow(remaining===0);const timer=window.setTimeout(()=>setSlow(true),remaining);return()=>window.clearTimeout(timer);},[startedAt]);
 const currentIndex=steps.findIndex(step=>step.id===phase);const failed=phase==='failed';const needsSignIn=phase==='needs-sign-in';
 return <main className="lotle-start-transition" aria-busy={!failed&&!needsSignIn}>
  <div className="lotle-start-transition-glow" aria-hidden="true"/>
  <div className="lotle-start-transition-content"><Logo size="sm" className="lotle-start-transition-logo"/>
   {failed||needsSignIn?<section className="lotle-start-transition-result" role="alert"><h1>{needsSignIn?'Your account is ready':'We could not finish setting up your showroom'}</h1><p>{error||(needsSignIn?'Your account was created. Sign in to continue setting up your showroom.':'Something went wrong. Please try again.')}</p><div className="lotle-start-transition-actions">{needsSignIn?<button type="button" onClick={onSignIn}>Sign in to continue</button>:<button type="button" onClick={onRetry}>Try again</button>}<button type="button" className="lotle-start-transition-secondary" onClick={onBack}>Back to sign up</button></div></section>:<>
    <div className="lotle-start-transition-indicator" aria-hidden="true"><span/></div><h1>Setting up your showroom</h1><p className="lotle-start-transition-subtext">This takes a few seconds.</p>
    <ol className="lotle-start-transition-steps" role="status" aria-live="polite">{steps.map((step,index)=>{const done=currentIndex>=0&&index<currentIndex;const active=step.id===phase;return <li key={step.id} className={done?'is-done':active?'is-active':'is-pending'}><span className="lotle-start-transition-step-icon" aria-hidden="true">{done?<Check size={14}/>:active?<span/>:null}</span><span>{step.label}</span></li>;})}</ol>
    {slow&&<p className="lotle-start-transition-slow" role="status">Still working, please keep this page open.</p>}
   </>}
  </div>
 </main>;
};
