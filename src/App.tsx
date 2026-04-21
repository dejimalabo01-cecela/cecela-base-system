import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBuilding, faBullhorn, faHandshake } from '@fortawesome/free-solid-svg-icons';
import { useAuth } from './hooks/useAuth';
import { useProperties } from './hooks/useProperties';
import { useTemplates } from './hooks/useTemplates';
import { useMembers } from './hooks/useMembers';
import { useTheme } from './hooks/useTheme';
import { useRole } from './hooks/useRole';
import { Sidebar } from './components/Sidebar';
import { NewPropertyModal } from './components/NewPropertyModal';
import { GanttChart } from './components/GanttChart';
import { LoginPage } from './components/LoginPage';
import { ChangePasswordModal } from './components/ChangePasswordModal';
import { TemplateEditorModal } from './components/TemplateEditorModal';
import { CopyPropertyModal } from './components/CopyPropertyModal';
import { MemberManagerModal } from './components/MemberManagerModal';
import { PropertyListView } from './components/PropertyListView';
import { UserManagementModal } from './components/UserManagementModal';
import type { ModuleId } from './types';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';

// 準備中モジュールの画面定義
const COMING_SOON: Record<string, { icon: IconDefinition; label: string; description: string }> = {
  marketing: {
    icon: faBullhorn,
    label: 'マーケティング管理',
    description: '広告・集客・反響管理など、マーケティング機能を準備中です。',
  },
  sales: {
    icon: faHandshake,
    label: '営業管理',
    description: '商談・顧客・契約管理など、営業支援機能を準備中です。',
  },
};

export default function App() {
  const { user, loading: authLoading, signIn, signOut } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { role } = useRole(user?.id);
  const {
    properties, selectedProperty, loading,
    load: reloadProperties,
    setSelectedId, addProperty, copyProperty,
    updateTask, updateAssignee, updatePropertyName, deleteProperty, reorderTasks,
  } = useProperties();
  const { templates, addTemplate, updateTemplate, deleteTemplate, reorderTemplates } = useTemplates();

  async function handleAddTemplate(name: string, color: string) {
    await addTemplate(name, color);
    await reloadProperties();
  }
  const { members, addMember, deleteMember } = useMembers();

  const [activeModule, setActiveModule] = useState<ModuleId>('construction');
  const [showNewModal, setShowNewModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showList, setShowList] = useState(false);

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

  function handleSelectProperty(id: string) {
    setSelectedId(id);
    setShowList(false);
  }

  function handleChangeModule(id: ModuleId) {
    setActiveModule(id);
    // モジュール切替時は物件選択・一覧表示をリセット
    if (id !== 'construction') {
      setSelectedId(null);
      setShowList(false);
    }
  }

  const userEmail = user.email ?? '';

  // メインコンテンツの描画
  function renderMain() {
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
          onSelect={handleSelectProperty}
        />
      );
    }
    if (selectedProperty) {
      return (
        <GanttChart
          property={selectedProperty}
          members={members}
          role={role}
          onUpdateTask={(taskId, updates) => updateTask(selectedProperty.id, taskId, updates, userEmail)}
          onUpdateAssignee={(assigneeId) => updateAssignee(selectedProperty.id, assigneeId, userEmail)}
          onUpdatePropertyName={(name) => updatePropertyName(selectedProperty.id, name, userEmail)}
          onDelete={() => deleteProperty(selectedProperty.id)}
          onCopy={() => setShowCopyModal(true)}
          onReorderTasks={(orderedIds) => reorderTasks(selectedProperty.id, orderedIds)}
        />
      );
    }
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-gray-400 dark:text-gray-600">
        <FontAwesomeIcon icon={faBuilding} className="text-6xl mb-4 opacity-20" />
        <p className="text-lg font-medium text-gray-500 dark:text-gray-400">物件を選択してください</p>
        <p className="text-sm mt-2 text-gray-400 dark:text-gray-500">
          左のサイドバーから物件を選ぶか、
          {(role === 'admin' || role === 'editor') && (
            <button onClick={() => setShowNewModal(true)} className="text-blue-500 hover:underline">
              新規物件を登録
            </button>
          )}
          してください
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900 overflow-hidden font-sans">
      <Sidebar
        activeModule={activeModule}
        onChangeModule={handleChangeModule}
        showList={showList}
        onShowList={() => setShowList(true)}
        onNew={() => setShowNewModal(true)}
        userEmail={userEmail}
        onSignOut={signOut}
        onChangePassword={() => setShowPasswordModal(true)}
        onEditTemplates={() => setShowTemplateModal(true)}
        onManageMembers={() => setShowMemberModal(true)}
        onManageUsers={() => setShowUserModal(true)}
        isDark={isDark}
        onToggleTheme={toggleTheme}
        role={role}
      />

      <main className="flex-1 overflow-hidden flex flex-col">
        {renderMain()}
      </main>

      {showNewModal && (
        <NewPropertyModal onAdd={addProperty} onClose={() => setShowNewModal(false)} />
      )}
      {showPasswordModal && (
        <ChangePasswordModal onClose={() => setShowPasswordModal(false)} />
      )}
      {showTemplateModal && (
        <TemplateEditorModal
          templates={templates}
          onAdd={handleAddTemplate}
          onUpdate={updateTemplate}
          onDelete={deleteTemplate}
          onReorder={reorderTemplates}
          onClose={() => setShowTemplateModal(false)}
        />
      )}
      {showMemberModal && (
        <MemberManagerModal
          members={members}
          onAdd={addMember}
          onDelete={deleteMember}
          onClose={() => setShowMemberModal(false)}
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
          onClose={() => setShowUserModal(false)}
        />
      )}
    </div>
  );
}
