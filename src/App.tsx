import { useState } from 'react';
import { useAuth } from './hooks/useAuth';
import { useProperties } from './hooks/useProperties';
import { Sidebar } from './components/Sidebar';
import { NewPropertyModal } from './components/NewPropertyModal';
import { GanttChart } from './components/GanttChart';
import { LoginPage } from './components/LoginPage';
import { ChangePasswordModal } from './components/ChangePasswordModal';

export default function App() {
  const { user, loading: authLoading, signIn, signOut } = useAuth();
  const { properties, selectedProperty, selectedId, loading, setSelectedId, addProperty, updateTask } =
    useProperties();
  const [showModal, setShowModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

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

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden font-sans">
      <Sidebar
        properties={properties}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onNew={() => setShowModal(true)}
        userEmail={user.email ?? ''}
        onSignOut={signOut}
        onChangePassword={() => setShowPasswordModal(true)}
      />

      <main className="flex-1 overflow-hidden flex flex-col">
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
            データを読み込み中...
          </div>
        ) : selectedProperty ? (
          <GanttChart
            property={selectedProperty}
            onUpdateTask={(taskId, updates) => updateTask(selectedProperty.id, taskId, updates)}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
            <div className="text-6xl mb-4">🏗️</div>
            <p className="text-lg font-medium">物件を選択してください</p>
            <p className="text-sm mt-2">
              左のサイドバーから物件を選ぶか、
              <button onClick={() => setShowModal(true)} className="text-blue-500 hover:underline">
                新規物件を登録
              </button>
              してください
            </p>
          </div>
        )}
      </main>

      {showModal && (
        <NewPropertyModal onAdd={addProperty} onClose={() => setShowModal(false)} />
      )}

      {showPasswordModal && (
        <ChangePasswordModal onClose={() => setShowPasswordModal(false)} />
      )}
    </div>
  );
}
