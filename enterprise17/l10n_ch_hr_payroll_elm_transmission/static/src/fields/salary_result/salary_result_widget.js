/** @odoo-module **/

import { registry } from "@web/core/registry";
import {Component, onWillUpdateProps, useState} from "@odoo/owl";
import { SwissdecNotification } from "@l10n_ch_hr_payroll_elm_transmission/components/swissdec_notification";
import { AccordionItem } from "@web/core/dropdown/accordion_item";

class SalaryResultWidget extends Component {
    static components = {
        SwissdecNotification,
        AccordionItem
    };
    setup() {

        this.state = useState({
            parsedData: this.props.record.data[this.props.name],
            institution_domain: this.props.record.data["domain"]
        });
        onWillUpdateProps((nextProps) => {
            this.state.parsedData = nextProps.record.data[this.props.name];
            this.state.institution_domain = nextProps.record.data["domain"];
        })
    }
}

SalaryResultWidget.template = "l10n_ch_hr_payroll_elm_transmission.SalaryResultWidgetTemplate";

registry.category("fields").add("swissdec_salary_result", {
    component: SalaryResultWidget,
});

export default SalaryResultWidget;
