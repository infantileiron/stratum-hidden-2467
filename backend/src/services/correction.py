import math,re
from dataclasses import asdict
from fastapi import HTTPException
from src.constants.domain import MAX_ROWS
from src.models.entities import ReadingCorrection
from src.utils import repository as repo
from src.utils.identity import new_id,now
def revision_of(dataset):return dataset.get('revision',1)
def _diff(dataset,changes):
 seen=set();index={}
 for r in dataset['rows']:index.setdefault(r['borehole'],{})[round(r['depth_m'],6)]=r
 diff=[]
 for c in changes:
  hole,depth,value=c['borehole'],c['depth_m'],c['value']
  if not re.fullmatch(r'[A-Za-z0-9_-]{1,30}',hole):raise ValueError('孔ID需1—30位字母数字下划线连字符，整批撤销')
  if not math.isfinite(depth) or not 0<=depth<=10000:raise ValueError(f'更正深度须有限且在[0,10000]米：{hole}@{depth}，整批撤销')
  if not math.isfinite(value) or abs(value)>1e6:raise ValueError(f'更正读数须有限且绝对值≤1e6：{hole}@{depth}，整批撤销')
  key=(hole,round(depth,6))
  if key in seen:raise ValueError(f'批内重复深度{hole}@{depth}，整批撤销')
  seen.add(key)
  target=index.get(hole,{}).get(key[1])
  if target is None:raise ValueError(f'未知位置{hole}@{depth}：该孔段不存在此深度，整批撤销')
  diff.append({'borehole':hole,'depth_m':target['depth_m'],'old_value':target['value'],'new_value':value})
 return diff
def _apply(dataset,diff):
 fixes={}
 for d in diff:fixes.setdefault(d['borehole'],{})[round(d['depth_m'],6)]=d['new_value']
 rows=[]
 for r in dataset['rows']:
  v=fixes.get(r['borehole'],{}).get(round(r['depth_m'],6))
  rows.append(r if v is None else {**r,'value':v})
 last={};counts={}
 for r in rows:
  h=r['borehole']
  if h in last and not math.isclose(r['depth_m']-last[h],1.,rel_tol=0,abs_tol=1e-9):raise ValueError('更正后孔段不再完整等距，整批撤销')
  last[h]=r['depth_m'];counts[h]=counts.get(h,0)+1
 if len(rows)>MAX_ROWS or any(n<3 for n in counts.values()):raise ValueError('更正后孔段不再完整，整批撤销')
 return rows
def preview(id,data):
 d=repo.get('datasets',id);diff=_diff(d,[c.model_dump() for c in data.changes])
 return {'dataset_id':id,'base_revision':revision_of(d),'change_count':len(diff),'changes':diff}
def confirm(id,data,actor):
 record={}
 def apply(d):
  base=revision_of(d)
  if data.base_revision!=base:raise HTTPException(409,f'该数据集读数已被他人更正到v{base}，与预览基于的v{data.base_revision}不一致；请重新预览差异后再确认，未覆盖他人更正')
  diff=_diff(d,[c.model_dump() for c in data.changes]);rows=_apply(d,diff)
  d['rows']=rows;d['revision']=base+1
  record.update(asdict(ReadingCorrection(new_id('corr'),id,actor,base,base+1,diff,now())))
  return d,[('corrections',record)]
 repo.mutate('datasets',id,apply)
 return record
def history(id):
 repo.get('datasets',id)
 return sorted((c for c in repo.all_rows('corrections') if c['dataset_id']==id),key=lambda c:(c['created_at'],c['id']),reverse=True)
