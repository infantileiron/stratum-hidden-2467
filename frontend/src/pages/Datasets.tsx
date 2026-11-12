import {useEffect,useState} from 'react';
import * as api from '../api/datasets';
import {useResource} from '../hooks/useResource';
import {refreshResources,resourceEvents} from '../stores/resources';
import PageTitle from '../components/common/PageTitle';
import Notice from '../components/common/Notice';
import type {Correction,CorrectionChange,CorrectionPreview,User} from '../types/entities';
function parseChanges(text:string):CorrectionChange[]{
 const lines=text.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
 if(lines.length&&/^borehole\s*,/i.test(lines[0]))lines.shift();
 if(!lines.length)throw new Error('请粘贴需要更正的 borehole,depth_m,value 行');
 return lines.map(line=>{
  const parts=line.split(',').map(s=>s.trim());
  if(parts.length!==3||parts.some(p=>p===''))throw new Error('每行需为 borehole,depth_m,value 三列：'+line);
  const depth_m=Number(parts[1]),value=Number(parts[2]);
  if(!Number.isFinite(depth_m)||!Number.isFinite(value))throw new Error('存在无法解析的深度或读数：'+line);
  return{borehole:parts[0],depth_m,value};
 });
}
export default function Datasets({user}:{user:User}){
 const{data,error}=useResource(api.list,[]);
 const[name,setName]=useState('补充完整孔段测井'),[source,setSource]=useState('shenxi_logs_import.csv'),[text,setText]=useState(''),[message,setMessage]=useState('');
 const[corrId,setCorrId]=useState(''),[corrText,setCorrText]=useState(''),[staged,setStaged]=useState<CorrectionChange[]>([]),[preview,setPreview]=useState<CorrectionPreview|null>(null),[done,setDone]=useState(''),[history,setHistory]=useState<Correction[]>([]);
 useEffect(()=>{if(!corrId&&data.length)setCorrId(data[0].id)},[data]);
 useEffect(()=>{if(!corrId)return;const load=()=>api.corrections(corrId).then(setHistory).catch(()=>{});load();resourceEvents.addEventListener('refresh',load);return()=>resourceEvents.removeEventListener('refresh',load)},[corrId]);
 const selected=data.find(d=>d.id===corrId);
 const doPreview=async()=>{try{const changes=parseChanges(corrText);setPreview(await api.previewCorrection(corrId,changes));setStaged(changes);setMessage('');setDone('')}catch(e:any){setPreview(null);setMessage(e.message)}};
 const doConfirm=async()=>{if(!preview)return;try{const rec=await api.confirmCorrection(corrId,preview.base_revision,staged);setDone(`已整批生效：读数v${rec.base_revision}→v${rec.new_revision}，共${rec.changes.length}处；新研究将采用v${rec.new_revision}，已有研究与批准报告保留原读数`);setPreview(null);setStaged([]);setCorrText('');setMessage('');refreshResources()}catch(e:any){setMessage(e.message);setDone('');if(/重新预览/.test(e.message)){setPreview(null);setStaged([]);refreshResources()}}};
 return <>
 <PageTitle chapter="02 / COMPLETE LOGS" title="缺一层，就不静默跨过去" description="CSV为borehole,depth_m,value，truth仅可选模拟参考。每孔至少3点、最多1000点，按输入固定1米严格递增；重复/缺层/倒序和非有限读数拒绝。补测读数可按孔号+深度批量更正：先预览差异，确认后整批生效并递增读数版本；重复深度、未知位置或坏值整批撤销。"/>
 <Notice error={error||message}/>
 <section className="paper table-scroll"><table><thead><tr><th>测井来源</th><th>读数版本</th><th>记录数</th><th>完整孔段</th></tr></thead><tbody>{data.map(d=><tr key={d.id}><td><b>{d.name}</b><small>{d.source}</small></td><td>v{d.revision}</td><td>{d.row_count}</td><td>{d.boreholes.join(' / ')}</td></tr>)}</tbody></table></section>
 {user.role!=='viewer'&&<form className="paper form-grid" onSubmit={async e=>{e.preventDefault();try{await api.create({name,source,csv_text:text});setMessage('');setText('');refreshResources()}catch(e:any){setMessage(e.message)}}}><label>数据集名称<input aria-label="数据集名称" value={name} onChange={e=>setName(e.target.value)}/></label><label>测井CSV文件<input aria-label="测井CSV文件" type="file" accept=".csv" onChange={async e=>{const f=e.target.files?.[0];if(f){if(f.size>400000){setMessage('CSV不能超过400KB');return}setSource(f.name);setText(await f.text())}}}/></label><label className="wide">测井内容<textarea aria-label="测井内容" value={text} onChange={e=>setText(e.target.value)} placeholder="borehole,depth_m,value,truth"/></label><button className="primary">校验并导入测井</button></form>}
 <section className="paper">
  <h2>补测读数更正与记录</h2>
  <div className="toolbar"><label>目标数据集<select aria-label="目标数据集" value={corrId} onChange={e=>{setCorrId(e.target.value);setPreview(null);setDone('')}}>{data.map(d=><option key={d.id} value={d.id}>{d.name} / 当前读数v{d.revision}</option>)}</select></label></div>
  {done&&<p className="method-note">{done}</p>}
  {user.role!=='viewer'?<form className="form-grid" onSubmit={e=>{e.preventDefault();doPreview()}}>
   <label>更正CSV文件<input aria-label="更正CSV文件" type="file" accept=".csv" onChange={async e=>{const f=e.target.files?.[0];if(f){if(f.size>400000){setMessage('CSV不能超过400KB');return}setCorrText(await f.text());setPreview(null)}}}/></label>
   <label className="wide">更正内容（borehole,depth_m,value；仅替换已存在深度的读数，不增删深度）<textarea aria-label="更正内容" value={corrText} onChange={e=>{setCorrText(e.target.value);setPreview(null)}} placeholder={'SX-01,140,66.5\nSX-01,141,67.2'}/></label>
   <button type="submit" className="primary">预览差异</button>
   {preview&&<button type="button" className="primary" onClick={doConfirm}>确认整批生效（基于读数v{preview.base_revision}）</button>}
  </form>:<p><small>更正需分析员或编辑权限；每批更正前后读数所有角色均可核查。</small></p>}
  {preview&&<div className="table-scroll"><h3>待确认差异 · 基于读数v{preview.base_revision} · 共{preview.change_count}处</h3><table><thead><tr><th>孔号</th><th>深度(m)</th><th>原读数</th><th>新读数</th></tr></thead><tbody>{preview.changes.map((c,i)=><tr key={i}><td>{c.borehole}</td><td>{c.depth_m}</td><td>{c.old_value}</td><td><b>{c.new_value}</b></td></tr>)}</tbody></table></div>}
  {history.map(c=><article className="record" key={c.id} style={{display:'block'}}><div><b>读数v{c.base_revision} → v{c.new_revision} · {c.changes.length}处</b><small>{c.actor} · {c.created_at.slice(0,19).replace('T',' ')}Z · 批次{c.id}</small></div><div className="table-scroll"><table><thead><tr><th>孔号</th><th>深度(m)</th><th>更正前</th><th>更正后</th></tr></thead><tbody>{c.changes.map((ch,i)=><tr key={i}><td>{ch.borehole}</td><td>{ch.depth_m}</td><td>{ch.old_value}</td><td><b>{ch.new_value}</b></td></tr>)}</tbody></table></div></article>)}
  {!history.length&&<p className="empty">该数据集暂无更正记录，读数仍为导入版本。</p>}
 </section>
 </>;
}
