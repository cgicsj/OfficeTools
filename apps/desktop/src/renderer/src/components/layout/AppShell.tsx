import type { ReactNode } from 'react';
import { FileSpreadsheet, Layers } from 'lucide-react';
import type { WorkflowTab } from '@shared/types/jobs';

type AppShellProps = {
  activeTab: WorkflowTab;
  onTabChange: (tab: WorkflowTab) => void;
  children: ReactNode;
};

const tabs: Array<{ id: WorkflowTab; label: string; icon: ReactNode }> = [
  { id: 'split', label: 'Excel 拆分', icon: <FileSpreadsheet size={18} aria-hidden="true" /> },
  { id: 'merge', label: 'Excel 合并', icon: <Layers size={18} aria-hidden="true" /> },
];

export const AppShell = ({ activeTab, onTabChange, children }: AppShellProps): JSX.Element => {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header__brand">
          <div className="app-header__mark" aria-hidden="true">
            OT
          </div>
          <div>
            <h1>OfficeTools</h1>
          </div>
        </div>
        <nav className="tab-nav" aria-label="OfficeTools">
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
    </div>
  );
};

