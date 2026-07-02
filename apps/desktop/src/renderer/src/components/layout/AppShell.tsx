import type { ReactNode } from 'react';
import { FileSpreadsheet, Layers, Table2 } from 'lucide-react';
import type { WorkflowTab } from '@shared/types/jobs';

type AppShellProps = {
  activeTab: WorkflowTab;
  onTabChange: (tab: WorkflowTab) => void;
  children: ReactNode;
};

const tabs: Array<{ id: WorkflowTab; label: string; icon: ReactNode }> = [
  { id: 'split', label: '表格拆分', icon: <FileSpreadsheet size={18} aria-hidden="true" /> },
  { id: 'merge', label: '表格合并', icon: <Layers size={18} aria-hidden="true" /> },
];

const modules: Array<{ label: string; icon: ReactNode; isActive?: boolean }> = [
  { label: '表格处理', icon: <Table2 size={18} aria-hidden="true" />, isActive: true },
];

export const AppShell = ({ activeTab, onTabChange, children }: AppShellProps): JSX.Element => {
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
              aria-current={module.isActive ? 'page' : undefined}
              className={module.isActive ? 'module-nav__item module-nav__item--active' : 'module-nav__item'}
              disabled={!module.isActive}
              key={module.label}
              title={module.label}
              type="button"
            >
              {module.icon}
              <span>{module.label}</span>
            </button>
          ))}
        </nav>
      </aside>
      <section className="app-content" aria-label="表格处理">
        <header className="app-content__header">
          <h2>表格处理</h2>
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
        </header>
        <main className="app-main">{children}</main>
      </section>
    </div>
  );
};
