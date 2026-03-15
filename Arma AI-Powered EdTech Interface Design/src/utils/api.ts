import { materialsApi } from '../services/api';

export async function fetchMaterials() {
  return materialsApi.list();
}

export async function createMaterial(data: { title: string; type: 'PDF' | 'YouTube' }) {
  return materialsApi.create({
    title: data.title,
    material_type: data.type.toLowerCase() as 'pdf' | 'youtube',
  });
}
