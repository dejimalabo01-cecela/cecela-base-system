import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBuilding, faHandshake, faBars } from '@fortawesome/free-solid-svg-icons';
import { getInitialModule, getAppTitle, getThemeColor, getThemeLabel } from './config/deployment';
import { useAuth } from './hooks/useAuth';
import { useProperties } from './hooks/useProperties';
import { useTemplates } from './hooks/useTemplates';
import { useMembers } from './hooks/useMembers';
import { useInquiries } from './hooks/useInquiries';
import { useTheme } from './hooks/useTheme';
import { useRole } from './hooks/useRole';
import { Sidebar } from './components/Sidebar';
import { NewPropertyModal } from './components/NewPropertyModal';
import { GanttChart } from './components/GanttChart';
import { LoginPage } from './components/LoginPage';
import { AcceptInvitePage } from './components/AcceptInvitePage';
import { ChangePasswordModal } from './components/ChangePasswordModal';
import { ProfileEditModal } from './components/ProfileEditModal';
import { TemplateEditorModal } from './components/TemplateEditorModal';
import { CopyPropertyModal } from './components/CopyPropertyModal';
import { PropertyListView } from './components/PropertyListView';
import { UserManagementModal } from './components/UserManagementModal';
import { SalesPlanView } from './components/SalesPlanView';
import { SalesPlanEditModal } from './components/SalesPlanEditModal';
import { CsvImportModal } from './components/CsvImportModal';
import { SalesManagementView } from './components/SalesManagementView';
import { MarketingView } from './components/MarketingView';
import type { ModuleId } from './types';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';

// 準備中モジュールの画面定義
const COMING_SOON: Record<string, { icon: IconDefinition; label: string; description: string }> = {
  sales: {
    icon: faHandshake,
    label: '営業管理',
    description: '商談・顧客・契約管理など、営業支援機能を準備中です。',
  },
};

// 招待リンク / パスワードリセットリンクから来たかどうかを、URL hash から検出する。
// supabase-js は detectSessionInUrl=true（既定）なので、初回マウント前に一度 hash を見ておく。
// これより後では supabase が hash をクリアしてしまうため、モジュールロード時の値を保持する。
const initialAuthFlow: 'invite' | 'recovery' | null = (() => {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash || '';
  if (hash.includes('type=invite')) return 'invite';
  if (hash.includes('type=recovery')) return 'recovery';
  return null;
})();

export default function App() {
  const { user, loading: authLoading, signIn, signOut } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { role, displayName, loadRole } = useRole(user?.id);
  // 初回ログイン or パスワードリセット完了までは AcceptInvitePage を出す
  const [pendingAuthFlow, setPendingAuthFlow] = useState<'invite' | 'recovery' | null>(initialAuthFlow);
  const {
    properties, selectedProperty, selectedId, loading,
    load: reloadProperties,
    setSelectedId, addProperty, copyProperty, copyProperties,
    updateTask, updateAssignee, updatePropertyName, updatePropertyId,
    deleteProperty, deleteProperties, reorderTasks,
    setTaskHidden, showAllTasks,
    syncWithTemplates,
    updateSalesInfo,
    importPropertiesFromCSV,
  } = useProperties(user?.id);
  const { templates, addTemplate, updateTemplate, deleteTemplate, reorderTemplates } = useTemplates(user?.id);

  // 物件担当者(assignee) が新規登録するときは、自分自身を assignee_id にセット
  // （そうしないと RLS でその新しい物件が本人にも見えなくなる）。
  async function handleAddProperty(name: string) {
    await addProperty(
      name,
      role === 'assignee' && user?.id ? { assigneeId: user.id } : undefined,
    );
  }

  async function handleAddTemplate(name: string, color: string) {
    await addTemplate(name, color);
    await reloadProperties();
  }

  async function handleUpdateTemplate(id: string, updates: Partial<{ name: string; color: string }>) {
    await updateTemplate(id, updates);
    await reloadProperties();
  }

  async function handleDeleteTemplate(id: string) {
    await deleteTemplate(id);
    await reloadProperties();
  }
  const { members } = useMembers(user?.id);
  const {
    inquiries,
    loading: inquiriesLoading,
    addInquiry, updateInquiry, deleteInquiry,
  } = useInquiries(user?.id);

  // 部署別 Vercel デプロイの場合、VITE_ENABLED_MODULES の先頭を初期表示にする
  const [activeModule, setActiveModule] = useState<ModuleId>(() => getInitialModule());

  // ブラウザタブのタイトルを VITE_APP_TITLE で上書き
  useEffect(() => {
    const t = getAppTitle();
    if (t && document.title !== t) document.title = t;
  }, []);
  const [showNewModal, setShowNewModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showList, setShowList] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [salesPlanEditId, setSalesPlanEditId] = useState<string | null>(null);
  const [showCsvImport, setShowCsvImport] = useState(false);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-gray-400 text-sm">読み込み中...</div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage onSignIn={signIn} />;
  }

  // 招待リンク / リセットリンクからの初回フロー
  // （supabase が自動でセッションを設定してくれているので、パスワードを設定するだけで完了）
  if (pendingAuthFlow) {
    return (
      <AcceptInvitePage
        onComplete={() => {
          setPendingAuthFlow(null);
          // URL から hash を取り除く（戻るで再表示されないように）
          if (window.history.replaceState) {
            window.history.replaceState(null, '', window.location.pathname + window.location.search);
          }
        }}
      />
    );
  }

  function handleSelectProperty(id: string) {
    setSelectedId(id);
    setShowList(false);
    setSidebarOpen(false);
  }

  function handleChangeModule(id: ModuleId) {
    setActiveModule(id);
    // モジュール切替時は物件選択・一覧表示をリセット
    if (id !== 'construction') {
      setSelectedId(null);
      setShowList(false);
    }
    setSidebarOpen(false);
  }

  function handleShowList() {
    setShowList(true);
    setSidebarOpen(false);
  }

  const userEmail = user.email ?? '';
  // 更新履歴（updated_by）に保存するラベル：表示名があればそれ、無ければメール。
  // GanttChart のタスク変更履歴 hover tooltip 等で「誰が編集したか」を読みやすく表示するために使う。
  const userLabel = (displayName && displayName.trim()) ? displayName.trim() : userEmail;
  const themeColor = getThemeColor();
  const themeLabel = getThemeLabel();

  // モバイルのトップバーに表示する現在の画面タイトル
  function currentScreenTitle(): string {
    if (activeModule === 'sales-management') return '販売管理';
    if (activeModule === 'sales-plan') return '販売計画';
    if (activeModule === 'marketing') return 'マーケ';
    if (activeModule === 'sales') return '営業';
    if (showList) return '物件一覧';
    if (selectedProperty) return selectedProperty.name;
    return '工程管理';
  }

  // メインコンテンツの描画
  function renderMain() {
    // マーケティング(反響管理)モジュール
    if (activeModule === 'marketing') {
      return (
        <MarketingView
          inquiries={inquiries}
          properties={properties}
          role={role}
          loading={inquiriesLoading}
          onAdd={(input) => addInquiry(input, userLabel)}
          onUpdate={(id, updates) => updateInquiry(id, updates, userLabel)}
          onDelete={deleteInquiry}
        />
      );
    }

    // 販売管理モジュール
    if (activeModule === 'sales-management') {
      if (loading) {
        return (
          <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm">
            データを読み込み中...
          </div>
        );
      }
      return (
        <SalesManagementView
          properties={properties}
          members={members}
          role={role}
          onSaveSalesInfo={(propertyId, updates) => updateSalesInfo(propertyId, updates, userLabel)}
          onImportCsv={() => setShowCsvImport(true)}
        />
      );
    }

    // 販売計画モジュール
    if (activeModule === 'sales-plan') {
      if (loading) {
        return (
          <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm">
            データを読み込み中...
          </div>
        );
      }
      return (
        <SalesPlanView
          properties={properties}
          members={members}
          role={role}
          onEdit={setSalesPlanEditId}
          onImportCsv={() => setShowCsvImport(true)}
          onDeleteMany={deleteProperties}
          onCopyMany={copyProperties}
        />
      );
    }

    // 準備中モジュール
    if (activeModule !== 'construction') {
      const info = COMING_SOON[activeModule];
      return (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
          <div className="w-20 h-20 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-6">
            <FontAwesomeIcon icon={info.icon} className="text-3xl text-gray-400 dark:text-gray-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-700 dark:text-gray-200 mb-2">{info.label}</h2>
          <p className="text-sm text-gray-400 dark:text-gray-500 max-w-sm">{info.description}</p>
          <span className="mt-4 text-xs bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 px-3 py-1.5 rounded-full">
            Coming Soon
          </span>
        </div>
      );
    }

    // 工程管理モジュール
    if (loading) {
      return (
        <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm">
          データを読み込み中...
        </div>
      );
    }
    if (showList) {
      return (
        <PropertyListView
          properties={properties}
          members={members}
          role={role}
          onSelect={handleSelectProperty}
          onDeleteMany={deleteProperties}
          onCopyMany={copyProperties}
        />
      );
    }
    if (selectedProperty) {
      return (
        <GanttChart
          property={selectedProperty}
          members={members}
          role={role}
          onUpdateTask={(taskId, updates) => updateTask(selectedProperty.id, taskId, updates, userLabel)}
          onUpdateAssignee={(assigneeId) => updateAssignee(selectedProperty.id, assigneeId, userLabel)}
          onUpdatePropertyName={(name) => updatePropertyName(selectedProperty.id, name, userLabel)}
          onUpdatePropertyId={(newId) => updatePropertyId(selectedProperty.id, newId)}
          onDelete={() => deleteProperty(selectedProperty.id)}
          onCopy={() => setShowCopyModal(true)}
          onReorderTasks={(orderedIds) => reorderTasks(selectedProperty.id, orderedIds)}
          onSetTaskHidden={(taskId, hidden) => setTaskHidden(selectedProperty.id, taskId, hidden)}
          onShowAllTasks={() => showAllTasks(selectedProperty.id)}
        />
      );
    }
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-gray-400 dark:text-gray-600">
        <FontAwesomeIcon icon={faBuilding} className="text-6xl mb-4 opacity-20" />
        <p className="text-lg font-medium text-gray-500 dark:text-gray-400">物件を選択してください</p>
        <p className="text-sm mt-2 text-gray-400 dark:text-gray-500">
          左のサイドバーから物件を選ぶか、
          {(role === 'admin' || role === 'editor' || role === 'assignee') && (
            <button onClick={() => setShowNewModal(true)} className="text-blue-500 hover:underline">
              新規物件を登録
            </button>
          )}
          してください
        </p>
      </div>
    );
  }

  // モバイル時にサイドバーを自動で閉じるようなラッパー
  const closeSidebar = () => setSidebarOpen(false);
  const withClose = (fn: () => void) => () => { fn(); closeSidebar(); };

  return (
    <div className="flex flex-col h-screen bg-gray-100 dark:bg-gray-900 overflow-hidden font-sans">
      {/* デプロイ別テーマカラー帯（どのシステムにログイン中か視覚的に区別するため） */}
      <div className="h-1 w-full shrink-0" style={{ backgroundColor: themeColor }} aria-hidden="true" />
      <div className="flex flex-1 min-h-0">
      {/* Mobile: overlay behind sidebar */}
      {sidebarOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-40"
          onClick={closeSidebar}
          aria-hidden="true"
        />
      )}

      {/* Sidebar - fixed-overlay on mobile, flex-child on desktop */}
      <div
        className={`
          fixed md:relative inset-y-0 left-0 z-50 md:z-auto shrink-0
          transform transition-transform duration-200 ease-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0
        `}
      >
        <Sidebar
          activeModule={activeModule}
          onChangeModule={handleChangeModule}
          properties={properties}
          selectedId={selectedId}
          showList={showList}
          onShowList={handleShowList}
          onSelect={handleSelectProperty}
          onNew={withClose(() => setShowNewModal(true))}
          userEmail={userEmail}
          onSignOut={signOut}
          onChangePassword={withClose(() => setShowPasswordModal(true))}
          onEditTemplates={withClose(() => setShowTemplateModal(true))}
          onManageUsers={withClose(() => setShowUserModal(true))}
          onEditProfile={withClose(() => setShowProfileModal(true))}
          isDark={isDark}
          onToggleTheme={toggleTheme}
          role={role}
          themeColor={themeColor}
          themeLabel={themeLabel}
          onCloseMobile={closeSidebar}
        />
      </div>

      <main className="flex-1 overflow-hidden flex flex-col min-w-0">
        {/* Mobile top bar */}
        <div className="md:hidden flex items-center gap-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-3 py-2 shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md w-10 h-10 flex items-center justify-center shrink-0"
            aria-label="メニューを開く"
          >
            <FontAwesomeIcon icon={faBars} />
          </button>
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-200 truncate flex-1">
            {currentScreenTitle()}
          </span>
        </div>

        {renderMain()}
      </main>
      </div>

      {showNewModal && (
        <NewPropertyModal onAdd={handleAddProperty} onClose={() => setShowNewModal(false)} />
      )}
      {showPasswordModal && (
        <ChangePasswordModal onClose={() => setShowPasswordModal(false)} />
      )}
      {showTemplateModal && (
        <TemplateEditorModal
          templates={templates}
          onAdd={handleAddTemplate}
          onUpdate={handleUpdateTemplate}
          onDelete={handleDeleteTemplate}
          onReorder={reorderTemplates}
          onSync={() => syncWithTemplates(templates)}
          onClose={() => setShowTemplateModal(false)}
        />
      )}
      {showCopyModal && selectedProperty && (
        <CopyPropertyModal
          sourceName={selectedProperty.name}
          onCopy={(newName, copyDates) => copyProperty(selectedProperty.id, newName, copyDates)}
          onClose={() => setShowCopyModal(false)}
        />
      )}
      {showUserModal && (
        <UserManagementModal
          currentUserId={user.id}
          currentRole={role}
          onClose={() => {
            setShowUserModal(false);
            // 自分の表示名を変えていた場合に hooks 側のキャッシュを更新
            loadRole();
          }}
        />
      )}
      {showProfileModal && (
        <ProfileEditModal
          userId={user.id}
          email={userEmail}
          onSaved={() => loadRole()}
          onClose={() => setShowProfileModal(false)}
        />
      )}
      {salesPlanEditId && (() => {
        const target = properties.find(p => p.id === salesPlanEditId);
        if (!target) return null;
        return (
          <SalesPlanEditModal
            property={target}
            isAdmin={role === 'admin'}
            onSaveSalesInfo={(updates) => updateSalesInfo(target.id, updates, userLabel)}
            onUpdatePropertyName={(name) => updatePropertyName(target.id, name, userLabel)}
            onUpdatePropertyId={async (newId) => {
              const result = await updatePropertyId(target.id, newId);
              // 物件IDが変わったら、編集中の参照も新IDに付け替える
              if (result.ok) setSalesPlanEditId(newId);
              return result;
            }}
            onClose={() => setSalesPlanEditId(null)}
          />
        );
      })()}
      {showCsvImport && (
        <CsvImportModal
          existingProperties={properties}
          onImport={importPropertiesFromCSV}
          onClose={() => setShowCsvImport(false)}
        />
      )}
    </div>
  );
}
