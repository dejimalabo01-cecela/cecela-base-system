import { useState } from 'react';
import { useAuth } from './hooks/useAuth';
import { useProperties } from './hooks/useProperties';
import { useTemplates } from './hooks/useTemplates';
import { useMembers } from './hooks/useMembers';
import { Sidebar } from './components/Sidebar';
import { NewPropertyModal } from './components/NewPropertyModal';
import { GanttChart } from './components/GanttChart';
import { LoginPage } from './components/LoginPage';
import { ChangePasswordModal } from './components/ChangePasswordModal';
import { TemplateEditorModal } from './components/TemplateEditorModal';
import { CopyPropertyModal } from './components/CopyPropertyModal';
import { MemberManagerModal } from './components/MemberManagerModal';
import { PropertyListView } from './components/PropertyListView';

export default function App() {
  const { user, loading: authLoading, signIn, signOut } = useAuth();
  const { properties, selectedProperty, selectedId, loading, setSelectedId, addProperty, copyProperty, updateTask, updateAssignee, deleteProperty } =
    useProperties();
  const { templates, addTemplate, updateTemplate, deleteTemplate, moveTemplate } = useTemplates();
  const { members, addMember, deleteMember } = useMembers();

  const [showNewModal, setShowNewModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [showCopyModal, setShowCopyModal] = useState(false);
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

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden font-sans">
      <Sidebar
        properties={properties}
        selectedId={selectedId}
        showList={showList}
        onSelect={handleSelectProperty}
        onShowList={() => setShowList(true)}
        onNew={() => setShowNewModal(true)}
        userEmail={user.email ?? ''}
        onSignOut={signOut}
        onChangePassword={() => setShowPasswordModal(true)}
        onEditTemplates={() => setShowTemplateModal(true)}
        onManageMembers={() => setShowMemberModal(true)}
      />

      <main className="flex-1 overflow-hidden flex flex-col">
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
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
            onUpdateTask={(taskId, updates) => updateTask(selectedProperty.id, taskId, updates)}
            onUpdateAssignee={(assigneeId) => updateAssignee(selectedProperty.id, assigneeId)}
            onDelete={() => deleteProperty(selectedProperty.id)}
            onCopy={() => setShowCopyModal(true)}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
            <div className="text-6xl mb-4">🏗️</div>
            <p className="text-lg font-medium">物件を選択してください</p>
            <p className="text-sm mt-2">
              左のサイドバーから物件を選ぶか、
              <button onClick={() => setShowNewModal(true)} className="text-blue-500 hover:underline">
                新規物件を登録
              </button>
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
    </div>
  );
}
