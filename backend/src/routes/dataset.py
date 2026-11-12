from fastapi import APIRouter,Depends
from src.controllers import dataset as controller
from src.schemas.entities import DatasetInput,RenameDataset,CorrectionPreviewInput,CorrectionConfirmInput
from src.services.auth import current,editor,admin
router=APIRouter(prefix="/datasets",tags=["datasets"])
@router.get("")
def list_items(user=Depends(current)): return controller.list_items()
@router.post("",status_code=201)
def create(data:DatasetInput,user=Depends(editor)): return controller.create(data)
@router.get("/{id}")
def detail(id:str,user=Depends(current)): return controller.detail(id)
@router.patch('/{id}')
def rename(id:str,data:RenameDataset,user=Depends(editor)):
 from src.services.dataset import rename
 return rename(id,data)
@router.post('/{id}/corrections/preview')
def preview_correction(id:str,data:CorrectionPreviewInput,user=Depends(editor)): return controller.preview_correction(id,data)
@router.post('/{id}/corrections/confirm',status_code=201)
def confirm_correction(id:str,data:CorrectionConfirmInput,user=Depends(editor)): return controller.confirm_correction(id,data,user)
@router.get('/{id}/corrections')
def list_corrections(id:str,user=Depends(current)): return controller.list_corrections(id)
