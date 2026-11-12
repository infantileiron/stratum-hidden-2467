import {request} from './client';import type {Dataset,Correction,CorrectionChange,CorrectionPreview} from '../types/entities';export const list=()=>request<Dataset[]>('/datasets');export const create=(data:unknown)=>request<Dataset>('/datasets','POST',data);
export const previewCorrection=(id:string,changes:CorrectionChange[])=>request<CorrectionPreview>(`/datasets/${id}/corrections/preview`,'POST',{changes});
export const confirmCorrection=(id:string,base_revision:number,changes:CorrectionChange[])=>request<Correction>(`/datasets/${id}/corrections/confirm`,'POST',{base_revision,changes});
export const corrections=(id:string)=>request<Correction[]>(`/datasets/${id}/corrections`);
