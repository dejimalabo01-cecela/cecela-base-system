import { useState, useEffect, useCallback } from 'react';
import type { Property, Task, TaskTemplate } from '../types';
import { supabase } from '../lib/supabase';

function generatePropertyId(properties: Property[]): string {
  const max = properties.reduce((m, p) => {
    const n = parseInt(p.id.replace('P-', ''), 10);
    return isNaN(n) ? m : Math.max(m, n);
  }, 0);
  return `P-${String(max + 1).padStart(3, '0')}`;
}

function uuid(): string {
  return crypto.randomUUID();
}

export function useProperties() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data: props } = await supabase
      .from('properties')
      .select('*')
      .order('created_at');

    if (!props) { setLoading(false); return; }

    const { data: tasks } = await supabase
      .from('tasks')
      .select('*')
      .order('order_index');

    const result: Property[] = props.map(p => {
      const seen = new Set<string>();
      const propertyTasks = (tasks ?? [])
        .filter(t => t.property_id === p.id)
        .filter(t => {
          if (seen.has(t.id)) return false;
          seen.add(t.id);
          return true;
        })
        .map(t => ({
          id: t.id,
          name: t.name,
          color: t.color ?? '#6B7280',
          startDate: t.start_date ?? null,
          endDate: t.end_date ?? null,
          updatedAt: t.updated_at ?? null,
          updatedBy: t.updated_by ?? null,
          hidden: t.hidden ?? false,
        }));

      return {
        id: p.id,
        name: p.name,
        createdAt: p.created_at,
        assigneeId: p.assignee_id ?? null,
        updatedAt: p.updated_at ?? null,
        updatedBy: p.updated_by ?? null,
        tasks: propertyTasks,
      };
    });

    setProperties(result);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function addProperty(name: string) {
    const id = generatePropertyId(properties);
    const { error: propError } = await supabase.from('properties').insert({ id, name });
    if (propError) { console.error('property insert error:', propError); return; }

    const { data: templates } = await supabase
      .from('task_templates')
      .select('*')
      .order('order_index');

    if (templates && templates.length > 0) {
      const { error: taskError } = await supabase.from('tasks').insert(
        templates.map((t, i) => ({
          id: uuid(),
          property_id: id,
          name: t.name,
          color: t.color,
          start_date: null,
          end_date: null,
          order_index: i,
        }))
      );
      if (taskError) console.error('tasks insert error:', taskError);
    }

    await load();
    setSelectedId(id);
  }

  async function copyProperty(sourceId: string, newName: string, copyDates: boolean) {
    const source = properties.find(p => p.id === sourceId);
    if (!source) return;

    const id = generatePropertyId(properties);
    const { error: propError } = await supabase.from('properties').insert({ id, name: newName });
    if (propError) { console.error('property insert error:', propError); return; }

    if (source.tasks.length > 0) {
      const { error: taskError } = await supabase.from('tasks').insert(
        source.tasks.map((t, i) => ({
          id: uuid(),
          property_id: id,
          name: t.name,
          color: t.color,
          start_date: copyDates ? t.startDate : null,
          end_date: copyDates ? t.endDate : null,
          order_index: i,
          hidden: t.hidden,
        }))
      );
      if (taskError) console.error('tasks insert error:', taskError);
    }

    await load();
    setSelectedId(id);
  }

  async function copyProperties(sourceIds: string[], copyDates: boolean): Promise<number> {
    const sources = sourceIds
      .map(id => properties.find(p => p.id === id))
      .filter((p): p is Property => !!p);
    if (sources.length === 0) return 0;

    const startMax = properties.reduce((m, p) => {
      const n = parseInt(p.id.replace('P-', ''), 10);
      return isNaN(n) ? m : Math.max(m, n);
    }, 0);

    const newIds: string[] = sources.map((_, i) =>
      `P-${String(startMax + 1 + i).padStart(3, '0')}`
    );

    const propertyInserts = sources.map((source, i) => ({
      id: newIds[i],
      name: `${source.name}_コピー`,
      assignee_id: source.assigneeId,
    }));

    const { error: propError } = await supabase.from('properties').insert(propertyInserts);
    if (propError) { console.error('properties insert error:', propError); return 0; }

    const taskInserts = sources.flatMap((source, i) =>
      source.tasks.map((t, idx) => ({
        id: uuid(),
        property_id: newIds[i],
        name: t.name,
        color: t.color,
        start_date: copyDates ? t.startDate : null,
        end_date: copyDates ? t.endDate : null,
        order_index: idx,
        hidden: t.hidden,
      }))
    );

    if (taskInserts.length > 0) {
      const { error: taskError } = await supabase.from('tasks').insert(taskInserts);
      if (taskError) console.error('tasks insert error:', taskError);
    }

    await load();
    return sources.length;
  }

  async function updateTask(
    propertyId: string,
    taskId: string,
    updates: Partial<Task>,
    userEmail?: string
  ) {
    const now = new Date().toISOString();
    setProperties(prev =>
      prev.map(p =>
        p.id !== propertyId ? p :
          {
            ...p, tasks: p.tasks.map(t => t.id !== taskId ? t : {
              ...t, ...updates,
              updatedAt: now,
              updatedBy: userEmail ?? null,
            })
          }
      )
    );

    // Try full update with history columns first
    const { error } = await supabase.from('tasks')
      .update({
        start_date: updates.startDate ?? null,
        end_date:   updates.endDate   ?? null,
        updated_at: now,
        updated_by: userEmail ?? null,
      })
      .eq('property_id', propertyId)
      .eq('id', taskId);

    // If history columns don't exist yet, fall back to basic update
    if (error) {
      await supabase.from('tasks')
        .update({
          start_date: updates.startDate ?? null,
          end_date:   updates.endDate   ?? null,
        })
        .eq('property_id', propertyId)
        .eq('id', taskId);
    }
  }

  async function updateAssignee(
    propertyId: string,
    assigneeId: string | null,
    userEmail?: string
  ) {
    const now = new Date().toISOString();
    setProperties(prev =>
      prev.map(p => p.id === propertyId
        ? { ...p, assigneeId, updatedAt: now, updatedBy: userEmail ?? null }
        : p
      )
    );

    const { error } = await supabase.from('properties')
      .update({ assignee_id: assigneeId, updated_at: now, updated_by: userEmail ?? null })
      .eq('id', propertyId);

    if (error) {
      await supabase.from('properties')
        .update({ assignee_id: assigneeId })
        .eq('id', propertyId);
    }
  }

  async function updatePropertyName(
    propertyId: string,
    name: string,
    userEmail?: string
  ) {
    const now = new Date().toISOString();
    setProperties(prev =>
      prev.map(p => p.id === propertyId
        ? { ...p, name, updatedAt: now, updatedBy: userEmail ?? null }
        : p
      )
    );

    const { error } = await supabase.from('properties')
      .update({ name, updated_at: now, updated_by: userEmail ?? null })
      .eq('id', propertyId);

    if (error) {
      await supabase.from('properties')
        .update({ name })
        .eq('id', propertyId);
    }
  }

  async function deleteProperty(propertyId: string) {
    await supabase.from('properties').delete().eq('id', propertyId);
    setProperties(prev => prev.filter(p => p.id !== propertyId));
    setSelectedId(prev => prev === propertyId ? null : prev);
  }

  async function deleteProperties(propertyIds: string[]) {
    if (propertyIds.length === 0) return;
    await supabase.from('properties').delete().in('id', propertyIds);
    const idSet = new Set(propertyIds);
    setProperties(prev => prev.filter(p => !idSet.has(p.id)));
    setSelectedId(prev => (prev && idSet.has(prev)) ? null : prev);
  }

  async function syncWithTemplates(templates: TaskTemplate[]): Promise<{ added: number; removed: number }> {
    const { data: props } = await supabase.from('properties').select('id');
    const { data: allTasks } = await supabase.from('tasks').select('property_id, id, name, order_index');
    if (!props) return { added: 0, removed: 0 };

    const templateNames = new Set(templates.map(t => t.name));
    const orphanNames = Array.from(
      new Set((allTasks ?? []).filter(t => !templateNames.has(t.name)).map(t => t.name))
    );

    let removed = 0;
    if (orphanNames.length > 0) {
      const { data: deleted } = await supabase
        .from('tasks')
        .delete()
        .in('name', orphanNames)
        .select('id');
      removed = deleted?.length ?? 0;
    }

    const taskNamesByProperty = new Map<string, Set<string>>();
    const maxOrderByProperty = new Map<string, number>();
    (allTasks ?? [])
      .filter(t => templateNames.has(t.name))
      .forEach(t => {
        const names = taskNamesByProperty.get(t.property_id) ?? new Set<string>();
        names.add(t.name);
        taskNamesByProperty.set(t.property_id, names);
        const cur = maxOrderByProperty.get(t.property_id) ?? -1;
        if (t.order_index > cur) maxOrderByProperty.set(t.property_id, t.order_index);
      });

    const toInsert: {
      id: string;
      property_id: string;
      name: string;
      color: string;
      start_date: null;
      end_date: null;
      order_index: number;
    }[] = [];

    for (const p of props) {
      const existing = taskNamesByProperty.get(p.id) ?? new Set<string>();
      let nextOrder = (maxOrderByProperty.get(p.id) ?? -1) + 1;
      for (const tmpl of templates) {
        if (!existing.has(tmpl.name)) {
          toInsert.push({
            id: crypto.randomUUID(),
            property_id: p.id,
            name: tmpl.name,
            color: tmpl.color,
            start_date: null,
            end_date: null,
            order_index: nextOrder++,
          });
        }
      }
    }

    if (toInsert.length > 0) {
      await supabase.from('tasks').insert(toInsert);
    }

    await load();
    return { added: toInsert.length, removed };
  }

  async function setTaskHidden(propertyId: string, taskId: string, hidden: boolean) {
    setProperties(prev =>
      prev.map(p => p.id !== propertyId ? p : {
        ...p,
        tasks: p.tasks.map(t => t.id === taskId ? { ...t, hidden } : t),
      })
    );
    await supabase.from('tasks')
      .update({ hidden })
      .eq('property_id', propertyId)
      .eq('id', taskId);
  }

  async function showAllTasks(propertyId: string) {
    const target = properties.find(p => p.id === propertyId);
    if (!target) return;
    const hiddenIds = target.tasks.filter(t => t.hidden).map(t => t.id);
    if (hiddenIds.length === 0) return;

    setProperties(prev =>
      prev.map(p => p.id !== propertyId ? p : {
        ...p,
        tasks: p.tasks.map(t => ({ ...t, hidden: false })),
      })
    );
    await supabase.from('tasks')
      .update({ hidden: false })
      .eq('property_id', propertyId)
      .in('id', hiddenIds);
  }

  async function reorderTasks(propertyId: string, orderedTaskIds: string[]) {
    const target = properties.find(p => p.id === propertyId);
    if (!target) return;

    const byId = new Map(target.tasks.map(t => [t.id, t]));
    const newTasks = orderedTaskIds
      .map(id => byId.get(id))
      .filter((t): t is Task => !!t);
    if (newTasks.length !== target.tasks.length) return;

    setProperties(prev =>
      prev.map(p => p.id === propertyId ? { ...p, tasks: newTasks } : p)
    );

    await Promise.all(
      newTasks.map((t, i) =>
        supabase.from('tasks')
          .update({ order_index: i })
          .eq('property_id', propertyId)
          .eq('id', t.id)
      )
    );
  }

  const selectedProperty = properties.find(p => p.id === selectedId) ?? null;

  return {
    properties, selectedProperty, selectedId, loading,
    load, setSelectedId, addProperty, copyProperty, copyProperties,
    updateTask, updateAssignee, updatePropertyName, deleteProperty, deleteProperties, reorderTasks,
    setTaskHidden, showAllTasks,
    syncWithTemplates,
  };
}
