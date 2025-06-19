/** @odoo-module **/

import { registry } from "@web/core/registry";
import { stepUtils } from "@web_tour/tour_service/tour_utils";


registry.category("web_tour.tours").add('account_accountant_bank_rec_widget_save_analytic_distribution', {
    url: '/web',
    steps: () => [
        stepUtils.showAppsMenuItem(),
        ...stepUtils.goToAppSteps('account_accountant.menu_accounting', "Open the accounting module"),
        {
            content: "Open the bank reconciliation widget",
            extra_trigger: ".o_breadcrumb",
            trigger: "button.btn-primary[name='action_open_reconcile']",
        },
        {
            content: "The 'line1' should be selected by default",
            extra_trigger: "div[name='line_ids']",
            trigger: "div[name='line_ids'] td[field='name']:contains('line1')",
            run: function() {},
        },
        {
            content: "Click on first line",
            trigger: "div[name='line_ids'] td[field='debit']:first",
        },
        {
            content: "The 'manual_operations_tab' should be active now and the auto_balance line mounted in edit",
            trigger: "a.active[name='manual_operations_tab']",
            run: function() {},
        },
        {
            content: "Enter an analytic distribution",
            trigger: "div[name='analytic_distribution'] .o_input_dropdown",
        },
        {
            content: "Select analytic distribution",
            trigger: "tr[name='line_0'] input",
            run: "text analytic_account",
        },
        {
            content: "Select analytic distribution",
            extra_trigger: ".ui-autocomplete",
            trigger: ".ui-autocomplete:visible li:contains('analytic_account')",
        },
        {
            content: "Close the analytic distribution",
            trigger: ".o_button",
        },
        stepUtils.toggleHomeMenu(),
        ...stepUtils.goToAppSteps(
            'account_accountant.menu_accounting',
            "Reset back to accounting module"
        ),
        {
            content: "check that we're back on the dashboard",
            trigger: 'a:contains("Customer Invoices")',
            run() {}
        }
    ]
});