/** @odoo-module **/

import { registry } from "@web/core/registry";

registry.category("web_tour.tours").add("test_worksheet_quality_check", {
    test: true,
    steps: () => [
        {
            trigger: ".form-check-input[name='Lovely Workcenter']",
            run: "click",
        },
        {
            trigger: "button:contains('Confirm')",
            run: "click",
        },
        {
            content: "Check that we are in the MO view",
            trigger: ".o_mrp_display_records button:contains('Lovely Workcenter')",
            run() {},
        },
        {
            content: "Swap to the WO view of the Lovely Workcenter",
            trigger: "button.btn-light:contains('Lovely Workcenter')",
            run: "click",
        },
        {
            content: "Register the production",
            trigger: ".o_mrp_record_line span:contains(Register Production)",
            run: "click",
        },
        {
            trigger: "button:contains('Validate')",
            run: "click",
        },
        {
            content: "Open the worksheet Quality Check",
            trigger: ".o_mrp_record_line span:contains(Lovely Worksheet)",
            run: "click",
        },
        {
            trigger: ".modal-header .modal-title:contains(Lovely Worksheet)",
            run() {},
        },
        {
            trigger: "div[name=x_passed] input[type=checkbox]",
            run: "click",
        },
        {
            trigger: ".o_form_button_save",
            run: "click",
        },
        {
            content: "Check that the quality check has been validated",
            trigger: ".btn:contains('Mark as Done')",
            run() {},

        },
        {
            trigger: ".btn:contains('Mark as Done')",
            run: "click",
        },
        {
            content: "Check that WO has been marked as done",
            trigger: ".btn:contains('Close Production')",
            run() {},
        },
        {
            trigger: ".btn:contains('Close Production')",
            run: "click",
        },
    ],
});
