/** @odoo-module */
import * as PartnerListScreenPoS from "@point_of_sale/../tests/tours/helpers/PartnerListScreenTourMethods";
import * as PartnerListScreenSettleDue from "@pos_settle_due/../tests/helpers/PartnerListScreenTourMethods";
const PartnerListScreen = { ...PartnerListScreenPoS, ...PartnerListScreenSettleDue };
import * as ProductScreen from "@point_of_sale/../tests/tours/helpers/ProductScreenTourMethods";
import * as PaymentScreen from "@point_of_sale/../tests/tours/helpers/PaymentScreenTourMethods";
import * as Utils from "@point_of_sale/../tests/tours/helpers/utils";
import { registry } from "@web/core/registry";

registry.category("web_tour.tours").add("SettleDueUICoherency", {
    test: true,
    steps: () =>
        [
            ProductScreen.clickPartnerButton(),
            PartnerListScreen.clickPartnerDetailsButton("A Partner"),
            PartnerListScreen.settleButtonTextIs("Deposit money"),
            PartnerListScreen.clickBack(),
            ProductScreen.clickPartnerButton(),
            PartnerListScreen.clickPartnerDetailsButton("B Partner"),
            PartnerListScreen.settleButtonTextIs("Settle due accounts"),
            { trigger: `.button.settle-due` },
            Utils.selectButton("Bank"),
            PaymentScreen.clickValidate(),
            { trigger: `.button.confirm:contains("Yes")` },
            {
                content: "Receipt doesn't include Empty State",
                trigger: ".pos-receipt:not(:has(i.fa-shopping-cart))",
            },
        ].flat(),
});

registry.category("web_tour.tours").add("test_settle_due_account_ui_coherency_2", {
    test: true,
    steps: () =>
        [
            ProductScreen.confirmOpeningPopup(),
            ProductScreen.clickPartnerButton(),
            PartnerListScreen.clickPartnerDetailsButton("B Partner"),
            Utils.negateStep({
                trigger: `.button.settle-due`,
                run: () => {},
            }),
        ].flat(),
});

registry.category("web_tour.tours").add("SettleDueAmountMoreCustomers", {
    test: true,
    steps: () =>
        [
            ProductScreen.confirmOpeningPopup(),
            ProductScreen.clickPartnerButton(),
            {
                trigger: ".pos-search-bar input",
                run: `text BPartner`,
            },
            {
                /**
                 * Manually trigger keyup event to show the search field list
                 * because the previous step do not trigger keyup event.
                 */
                trigger: ".pos-search-bar input",
                run: function () {
                    document
                        .querySelector(".pos-search-bar input")
                        .dispatchEvent(new KeyboardEvent("keyup", { key: "" }));
                },
            },
            Utils.selectButton("Search more"),
            {
                trigger: ".partner-line-balance:contains('10.00')",
                run: () => {},
            },
        ].flat(),
});
