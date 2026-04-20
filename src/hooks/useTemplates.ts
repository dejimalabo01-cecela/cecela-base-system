import { useState, useEffect, useCallback } from 'react';
import type { TaskTemplate } from '../types';
import { supabase } from '../lib/supabase';

export function useTemplates() {
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);

  const load = useCallback(async () => {
    const { data } = await supabase.from('task_templates').select('*').order('order_index');
    if (data) {
      setTemplates(data.map(t => ({
        id: t.id,
        name: t.name,
        color: t.color,
        orderIndex: t.order_index,
      })));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function addTemplate(name: string, color: string) {
    const id = `tt-${Date.now()}`;
    const orderIndex = templates.length;
    await supabase.from('task_templates').insert({ id, name, color, order_index: orderIndex });
    await load();
  }

  async function updateTemplate(id: string, updates: Partial<Pick<TaskTemplate, 'name' | 'color'>>) {
    await supabase.from('task_templates').update({ name: updates.name, color: updates.color }).eq('id', id);
    setTemplates(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  }

  async function deleteTemplate(id: string) {
    await supabase.from('task_templates').delete().eq('id', id);
    setTemplates(prev => prev.filter(t => t.id !== id));
  }

  async function moveTemplate(id: string, direction: 'up' | 'down') {
    const idx = templates.findIndex(t => t.id === id);
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === templates.length - 1) return;

    const newList = [...templates];
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    [newList[idx], newList[swapIdx]] = [newList[swapIdx], newList[idx]];

    setTemplates(newList);
    await Promise.all(
      newList.map((t, i) =>
        supabase.from('task_templates').update({ order_index: i }).eq('id', t.id)
      )
    );
  }

  return { templates, load, addTemplate, updateTemplate, deleteTemplate, moveTemplate };
}
