import { PayrunsListPage } from './PayrunsListPage.js';
import { PayrunWizardModal } from './PayrunWizardModal.js';

/**
 * Route target for `/payroll/payruns/new`: the list underneath, exactly as
 * it renders on its own route, with the wizard modal layered on top — so
 * the wizard reads as a modal over the payruns screen rather than a page of
 * its own.
 */
export function PayrunNewPage(): React.JSX.Element {
  return (
    <>
      <PayrunsListPage />
      <PayrunWizardModal />
    </>
  );
}
