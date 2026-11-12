from src.services import dataset as service
from src.services import correction
def list_items(): return service.list_datasets()
def detail(id): return service.detail(id)
def create(data): return service.create(data)
def preview_correction(id,data): return correction.preview(id,data)
def confirm_correction(id,data,user): return correction.confirm(id,data,user['email'])
def list_corrections(id): return correction.history(id)
