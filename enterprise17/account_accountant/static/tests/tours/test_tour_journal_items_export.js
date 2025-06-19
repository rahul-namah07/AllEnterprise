/** @odoo-module **/

import { registry } from "@web/core/registry";
import { stepUtils } from "@web_tour/tour_service/tour_utils";

registry.category("web_tour.tours").add("account_accountant_journal_items_export", {
    test: true,
    url: '/web',
    steps: () => [
        stepUtils.showAppsMenuItem(),
        ...stepUtils.goToAppSteps(
            'account_accountant.menu_accounting',
            "Open the accounting module",
        ),

        {
            content: "Open journal items list view",
            trigger: 'button[data-menu-xmlid="account.menu_finance_entries"]',
            run: "click",
        },
        {
            content: "Open journal items list view",
            trigger: 'a[data-menu-xmlid="account.menu_action_account_moves_all"]',
            run: "click",
        },
        {
            content: "Select all items",
            trigger: 'thead tr th.o_list_record_selector',
            run: "click",
        },
        {
            content: "Open export dialog",
            trigger: 'i.fa-cog',
            run: "click",
        },
        {
            content: "Open export dialog",
            trigger: 'span:contains("Export")',
            run: "click",
        },
        {
            content: "Click on the cancel button",
            trigger: 'button.o_form_button_cancel',
            run: "click",
        },
        // End
        stepUtils.toggleHomeMenu(),
        ...stepUtils.goToAppSteps(
            'account_accountant.menu_accounting',
            "Reset back to accounting module",
        ),
        {
            content: "check that we're back on the dashboard",
            trigger: 'a:contains("Customer Invoices")',
            run() {},
        }
    ]
});
