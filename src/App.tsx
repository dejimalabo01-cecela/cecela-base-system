import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBuilding } from '@fortawesome/free-solid-svg-icons';
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

export default function App() {
  const { user, loading: authLoading, signIn, signOut } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { role } = useRole(user?.id);
  const {
    properties, selectedProperty, selectedId, loading,
    setSelectedId, addProperty, copyProperty,
    updateTask, updateAssignee, updatePropertyName, deleteProperty,
  } = useProperties();
  const { templates, addTemplate, updateTemplate, deleteTemplate, moveTemplate } = useTemplates();
  const { members, addMember, deleteMember } = useMembers();

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

  const userEmail = user.email ?? '';

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900 overflow-hidden font-sans">
      <Sidebar
        properties={properties}
        selectedId={selectedId}
        showList={showList}
        onSelect={handleSelectProperty}
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
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm">
            データを読み込み中...
          </div>
        ) : showList ? (
          <PropertyListView
            properties={properties}
            members={members}
            onSelect={handleSelectProperty}
          />
        ) : selectedProperty ? (
          <GanttChart
            property={selectedProperty}
            members={members}
            role={role}
            onUpdateTask={(taskId, updates) => updateTask(selectedProperty.id, taskId, updates, userEmail)}
            onUpdateAssignee={(assigneeId) => updateAssignee(selectedProperty.id, assigneeId, userEmail)}
            onUpdatePropertyName={(name) => updatePropertyName(selectedProperty.id, name, userEmail)}
            onDelete={() => deleteProperty(selectedProperty.id)}
            onCopy={() => setShowCopyModal(true)}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 dark:text-gray-600">
            <FontAwesomeIcon icon={faBuilding} className="text-6xl mb-4 opacity-30" />
            <p className="text-lg font-medium text-gray-500 dark:text-gray-400">物件を選択してください</p>
            <p className="text-sm mt-2 text-gray-400 dark:text-gray-500">
              左のサイドバーから物件を選ぶか、
              {(role === 'admin' || role === 'editor') && (
                <button
                  onClick={() => setShowNewModal(true)}
                  className="text-blue-500 hover:underline"
                >
                  新規物件を登録
                </button>
              )}
              してください
            </p>
          </div>
        )}
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
          onAdd={addTemplate}
          onUpdate={updateTemplate}
          onDelete={deleteTemplate}
          onMove={moveTemplate}
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
