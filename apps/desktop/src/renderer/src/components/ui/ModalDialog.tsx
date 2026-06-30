import { useId } from 'react';
import { Button } from './Button';
import type { ButtonVariant } from './Button';

type ModalDialogAction = {
  label: string;
  onClick: () => void;
  title?: string;
  variant?: ButtonVariant;
};

type ModalDialogProps = {
  actions: ModalDialogAction[];
  description: string;
  title: string;
};

export const ModalDialog = ({ actions, description, title }: ModalDialogProps): JSX.Element => {
  const titleId = useId();
  const descriptionId = useId();

  return (
    <div className="modal-backdrop">
      <section
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="modal-dialog"
        role="dialog"
      >
        <div className="modal-dialog__body">
          <h2 id={titleId}>{title}</h2>
          <p id={descriptionId}>{description}</p>
        </div>
        <div className="modal-dialog__actions">
          {actions.map((action) => (
            <Button
              key={action.label}
              onClick={action.onClick}
              title={action.title ?? action.label}
              variant={action.variant ?? 'secondary'}
            >
              {action.label}
            </Button>
          ))}
        </div>
      </section>
    </div>
  );
};
