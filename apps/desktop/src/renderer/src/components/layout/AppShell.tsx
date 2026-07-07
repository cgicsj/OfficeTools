import type { ReactNode } from 'react';
import { FileAudio2, FileSpreadsheet, Layers, Table2 } from 'lucide-react';
import type { WorkflowTab } from '@shared/types/jobs';

export type AppModule = 'tables' | 'speech';

type AppShellProps = {
  activeModule: AppModule;
  activeTab: WorkflowTab;
  onModuleChange: (module: AppModule) => void;
  onTabChange: (tab: WorkflowTab) => void;
  children: ReactNode;
};

const tabs: Array<{ id: WorkflowTab; label: string; icon: ReactNode }> = [
  { id: 'split', label: '表格拆分', icon: <FileSpreadsheet size={18} aria-hidden="true" /> },
  { id: 'merge', label: '表格合并', icon: <Layers size={18} aria-hidden="true" /> },
];

const modules: Array<{ id: AppModule; label: string; icon: ReactNode }> = [
  { id: 'tables', label: '表格处理', icon: <Table2 size={18} aria-hidden="true" /> },
  { id: 'speech', label: '语音转文字', icon: <FileAudio2 size={18} aria-hidden="true" /> },
];

export const AppShell = ({
  activeModule,
  activeTab,
  onModuleChange,
  onTabChange,
  children,
}: AppShellProps): JSX.Element => {
  const title = activeModule === 'tables' ? '表格处理' : '语音转文字';
  return (
    <div className="app-shell">
      <aside className="app-sidebar" aria-label="功能模块">
        <div className="app-sidebar__brand">
          <div className="app-sidebar__mark" aria-hidden="true">
            OT
          </div>
          <h1>OfficeTools</h1>
        </div>
        <nav className="module-nav" aria-label="工具分类">
          {modules.map((module) => (
            <button
              aria-current={activeModule === module.id ? 'page' : undefined}
              className={activeModule === module.id ? 'module-nav__item module-nav__item--active' : 'module-nav__item'}
              key={module.id}
              onClick={() => onModuleChange(module.id)}
              title={module.label}
              type="button"
            >
              {module.icon}
              <span>{module.label}</span>
            </button>
          ))}
        </nav>
      </aside>
      <section className="app-content" aria-label={title}>
        <header className="app-content__header">
          <h2>{title}</h2>
          {activeModule === 'tables' ? (
            <nav className="tab-nav" aria-label="表格处理功能">
              {tabs.map((tab) => (
                <button
                  aria-current={activeTab === tab.id ? 'page' : undefined}
                  className={activeTab === tab.id ? 'tab-nav__item tab-nav__item--active' : 'tab-nav__item'}
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  title={tab.label}
                  type="button"
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              ))}
            </nav>
          ) : (
            <nav className="tab-nav" aria-label="语音转文字功能">
              <button aria-current="page" className="tab-nav__item tab-nav__item--active" type="button">
                <FileAudio2 size={18} aria-hidden="true" />
                <span>音频转文字</span>
              </button>
            </nav>
          )}
        </header>
        <main className="app-main">{children}</main>
      </section>
    </div>
  );
};
