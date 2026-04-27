import { useState, useEffect, useCallback } from 'react';
import type { Property, Task, TaskTemplate, PropertyStatus, PropertyType } from '../types';
import { supabase } from '../lib/supabase';

// CSVから取込む1行ぶんの形。値が undefined のフィールドは「変更しない」、
// null は「明示的に空にする」という意味で使い分ける。
export interface ImportPropertyRow {
  id: string;
  name?: string;
  propertyType?: PropertyType | null;
  status?: PropertyStatus | null;
  salePrice?: number | null;
  pricePending?: boolean;
  saleStartDate?: string | null;
  contractDate?: string | null;
  settlementDate?: string | null;
}

// 物件IDフォーマット：'001' 〜 '999...' の連番。
// `P-001` 形式の旧データも、`003.1` のような枝番付きIDも、先頭の整数部分を見て最大値を算出する。
function maxPropertyIdNumber(properties: Property[]): number {
  return properties.reduce((m, p) => {
    const stripped = p.id.replace(/^P-/, '');
    const match = stripped.match(/^(\d+)/);
    if (!match) return m;
    const n = parseInt(match[1], 10);
    return isNaN(n) ? m : Math.max(m, n);
  }, 0);
}

function generatePropertyId(properties: Property[]): string {
  return String(maxPropertyIdNumber(properties) + 1).padStart(3, '0');
}

// 編集後の物件IDが許可されたフォーマットかチェック。
// 英数字 + '.', '-', '_' のみ、空文字不可。
export function isValidPropertyId(id: string): boolean {
  return /^[A-Za-z0-9._-]+$/.test(id);
}

function uuid(): string {
  return crypto.randomUUID();
}

export function useProperties(userId: string | undefined) {
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // 初回ロードの "データを読み込み中..." は initial state (useState(true)) で出る。
  // 追加・コピー・同期 後の再ロードでは loading をトグルしない（画面全体が
  // フラッシュして「重い」感覚になるため）。
  const load = useCallback(async () => {
    const { data: props, error: propsError } = await supabase
      .from('properties')
      .select('*')
      .order('created_at');

    if (propsError) {
      console.error('properties load error:', propsError);
      setLoading(false);
      return;
    }
    if (!props) { setLoading(false); return; }

    const { data: tasks, error: tasksError } = await supabase
      .from('tasks')
      .select('*')
      .order('order_index');

    if (tasksError) {
      console.error('tasks load error:', tasksError);
    }

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
        // 販売計画用フィールド（未マイグレーションのDBでも undefined で安全）
        propertyType: p.property_type ?? null,
        status: p.status ?? null,
        cost: p.cost ?? null,
        loan: p.loan ?? null,
        salePrice: p.sale_price ?? null,
        saleStartDate: p.sale_start_date ?? null,
        contractDate: p.contract_date ?? null,
        settlementDate: p.settlement_date ?? null,
        pricePending: p.price_pending ?? false,
        salePriceUpdatedAt: p.sale_price_updated_at ?? null,
      };
    });

    setProperties(result);
    setLoading(false);
  }, []);

  // 認証が完了する（userIdが入る）まで load を呼ばない。
  // RLS が `TO authenticated` になっているので、未認証で叩くと空配列が返り、
  // 結果として「物件0件」のままになるバグの原因だった。
  useEffect(() => {
    if (userId) {
      load();
    } else {
      // ログアウト時はクリア
      setProperties([]);
      setSelectedId(null);
      setLoading(true);
    }
  }, [load, userId]);

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

    const startMax = maxPropertyIdNumber(properties);
    const newIds: string[] = sources.map((_, i) =>
      String(startMax + 1 + i).padStart(3, '0')
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

    // updatesに含まれているフィールドだけ送る（含まれていないフィールドを `?? null` で
    // 渡すと、片方だけ更新したときにもう片方を NULL で上書きしてしまうバグになる）。
    const dbUpdates: Record<string, unknown> = {
      updated_at: now,
      updated_by: userEmail ?? null,
    };
    if (updates.startDate !== undefined) dbUpdates.start_date = updates.startDate;
    if (updates.endDate !== undefined)   dbUpdates.end_date   = updates.endDate;

    const { error } = await supabase.from('tasks')
      .update(dbUpdates)
      .eq('property_id', propertyId)
      .eq('id', taskId);

    // 履歴カラムが無い古いDBへのフォールバック
    if (error) {
      const fallback: Record<string, unknown> = {};
      if (updates.startDate !== undefined) fallback.start_date = updates.startDate;
      if (updates.endDate !== undefined)   fallback.end_date   = updates.endDate;
      const { error: fallbackError } = await supabase.from('tasks')
        .update(fallback)
        .eq('property_id', propertyId)
        .eq('id', taskId);
      if (fallbackError) {
        console.error('updateTask failed (fallback):', fallbackError);
      }
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

  /**
   * 物件IDの変更。重複チェックとフォーマット検証を行う。
   * Supabase 側で ON UPDATE CASCADE が効いていれば tasks.property_id も自動追随する
   * （schema_update_v5.sql 実行後）。
   *
   * 戻り値: { ok: true } 成功 / { ok: false, reason } 失敗（reasonでUI側でメッセージ出し分け）
   */
  async function updatePropertyId(
    oldId: string,
    newId: string,
  ): Promise<{ ok: true } | { ok: false; reason: 'invalid' | 'duplicate' | 'notfound' | 'db' }> {
    if (oldId === newId) return { ok: true };
    if (!isValidPropertyId(newId)) return { ok: false, reason: 'invalid' };
    if (properties.some(p => p.id === newId)) return { ok: false, reason: 'duplicate' };
    if (!properties.some(p => p.id === oldId)) return { ok: false, reason: 'notfound' };

    const { error } = await supabase.from('properties').update({ id: newId }).eq('id', oldId);
    if (error) {
      console.error('updatePropertyId error:', error);
      return { ok: false, reason: 'db' };
    }

    setProperties(prev =>
      prev.map(p => p.id === oldId
        ? { ...p, id: newId, tasks: p.tasks }   // tasks rows are auto-cascaded server-side
        : p
      )
    );
    setSelectedId(prev => prev === oldId ? newId : prev);
    return { ok: true };
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

  // 販売計画モジュール用：追加フィールドの更新
  async function updateSalesInfo(
    propertyId: string,
    updates: Partial<Pick<Property,
      'propertyType' | 'status' | 'cost' | 'loan' | 'salePrice' |
      'saleStartDate' | 'contractDate' | 'settlementDate' | 'pricePending'
    >>,
    userEmail?: string,
  ) {
    const now = new Date().toISOString();

    // 販売価格が実際に変わったときだけ価格変更日を更新する
    const current = properties.find(p => p.id === propertyId);
    const priceChanged =
      updates.salePrice !== undefined &&
      (current?.salePrice ?? null) !== (updates.salePrice ?? null);
    const priceUpdatedAt = priceChanged ? now : undefined;

    setProperties(prev =>
      prev.map(p => p.id === propertyId
        ? {
            ...p, ...updates,
            updatedAt: now,
            updatedBy: userEmail ?? null,
            ...(priceChanged ? { salePriceUpdatedAt: now } : {}),
          }
        : p
      )
    );

    const dbUpdates: Record<string, unknown> = {
      updated_at: now,
      updated_by: userEmail ?? null,
    };
    if (updates.propertyType !== undefined)   dbUpdates.property_type    = updates.propertyType;
    if (updates.status !== undefined)         dbUpdates.status           = updates.status;
    if (updates.cost !== undefined)           dbUpdates.cost             = updates.cost;
    if (updates.loan !== undefined)           dbUpdates.loan             = updates.loan;
    if (updates.salePrice !== undefined)      dbUpdates.sale_price       = updates.salePrice;
    if (updates.saleStartDate !== undefined)  dbUpdates.sale_start_date  = updates.saleStartDate;
    if (updates.contractDate !== undefined)   dbUpdates.contract_date    = updates.contractDate;
    if (updates.settlementDate !== undefined) dbUpdates.settlement_date  = updates.settlementDate;
    if (updates.pricePending !== undefined)   dbUpdates.price_pending    = updates.pricePending;
    if (priceUpdatedAt)                       dbUpdates.sale_price_updated_at = priceUpdatedAt;

    const { error } = await supabase.from('properties').update(dbUpdates).eq('id', propertyId);
    if (error) {
      // マイグレーション未実行のときはフィールドが無くて失敗する可能性があるため、フォールバックとして履歴列だけ更新
      console.error('updateSalesInfo error:', error);
    }
  }

  /**
   * CSVインポート用のバルク取込み。
   * - ID が無い物件は新規追加（テンプレートからタスク自動生成）
   * - ID がある物件は overwrite=true のときだけ各フィールドを更新
   * 戻り値: 件数サマリー
   */
  async function importPropertiesFromCSV(
    rows: ImportPropertyRow[],
    overwrite: boolean,
  ): Promise<{ added: number; updated: number; skipped: number; errors: string[] }> {
    const errors: string[] = [];
    let added = 0;
    let updated = 0;
    let skipped = 0;

    const existingIds = new Set(properties.map(p => p.id));
    const now = new Date().toISOString();

    // 1) 新規追加リスト と 上書きリスト を分ける
    const toInsert: ImportPropertyRow[] = [];
    const toUpdate: ImportPropertyRow[] = [];
    for (const row of rows) {
      if (!row.id) {
        errors.push('物件IDが空の行があります（スキップ）');
        skipped++;
        continue;
      }
      if (existingIds.has(row.id)) {
        if (overwrite) toUpdate.push(row);
        else { skipped++; }
      } else {
        toInsert.push(row);
      }
    }

    // 2) 新規追加：properties に挿入し、テンプレートからタスクを生成
    if (toInsert.length > 0) {
      const propertyInserts = toInsert.map(r => ({
        id: r.id,
        name: r.name ?? `(物件 ${r.id})`,
        property_type: r.propertyType ?? null,
        status: r.status ?? null,
        sale_price: r.salePrice ?? null,
        price_pending: r.pricePending ?? false,
        sale_start_date: r.saleStartDate ?? null,
        contract_date: r.contractDate ?? null,
        settlement_date: r.settlementDate ?? null,
        sale_price_updated_at: r.salePrice != null ? now : null,
      }));
      const { error: insertError } = await supabase.from('properties').insert(propertyInserts);
      if (insertError) {
        errors.push(`新規追加に失敗: ${insertError.message}`);
      } else {
        added = toInsert.length;
        // テンプレートからタスクを生成
        const { data: templates } = await supabase
          .from('task_templates')
          .select('*')
          .order('order_index');
        if (templates && templates.length > 0) {
          const taskInserts = toInsert.flatMap(r =>
            templates.map((t, i) => ({
              id: uuid(),
              property_id: r.id,
              name: t.name,
              color: t.color,
              start_date: null,
              end_date: null,
              order_index: i,
            }))
          );
          const { error: tErr } = await supabase.from('tasks').insert(taskInserts);
          if (tErr) errors.push(`タスク生成に失敗: ${tErr.message}`);
        }
      }
    }

    // 3) 上書き：CSV に含まれる列だけ更新
    for (const row of toUpdate) {
      const current = properties.find(p => p.id === row.id);
      const dbUpdates: Record<string, unknown> = {
        updated_at: now,
      };
      if (row.name !== undefined)            dbUpdates.name             = row.name;
      if (row.propertyType !== undefined)    dbUpdates.property_type    = row.propertyType;
      if (row.status !== undefined)          dbUpdates.status           = row.status;
      if (row.salePrice !== undefined)       dbUpdates.sale_price       = row.salePrice;
      if (row.pricePending !== undefined)    dbUpdates.price_pending    = row.pricePending;
      if (row.saleStartDate !== undefined)   dbUpdates.sale_start_date  = row.saleStartDate;
      if (row.contractDate !== undefined)    dbUpdates.contract_date    = row.contractDate;
      if (row.settlementDate !== undefined)  dbUpdates.settlement_date  = row.settlementDate;
      // 価格が実際に変わるときだけ価格変更日を更新
      if (row.salePrice !== undefined && (current?.salePrice ?? null) !== (row.salePrice ?? null)) {
        dbUpdates.sale_price_updated_at = now;
      }
      const { error: uErr } = await supabase.from('properties').update(dbUpdates).eq('id', row.id);
      if (uErr) {
        errors.push(`${row.id} 更新失敗: ${uErr.message}`);
      } else {
        updated++;
      }
    }

    await load();
    return { added, updated, skipped, errors };
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
    updateTask, updateAssignee, updatePropertyName, updatePropertyId,
    deleteProperty, deleteProperties, reorderTasks,
    setTaskHidden, showAllTasks,
    syncWithTemplates,
    updateSalesInfo,
    importPropertiesFromCSV,
  };
}
