/** @odoo-module **/

import { registry } from "@web/core/registry";
import { ganttView } from "@web_gantt/gantt_view";
import { ProjectGanttModel } from "./project_gantt_model";


export const projectGanttView = {
    ...ganttView,
    Model: ProjectGanttModel,
};

registry.category("views").add("project_gantt", projectGanttView);
