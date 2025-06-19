/** @odoo-module **/

import { useService } from '@web/core/utils/hooks';
import { GanttModel } from "@web_gantt/gantt_model";

const COLOR_FIELD = "stage_id";

export class ProjectGanttModel extends GanttModel {
    setup(params) {
        super.setup(params);
        this.userService = useService('user');
    }

    /**
     * @override
     */
    async load(searchParams) {
        const stagesEnabled = await this.userService.hasGroup('project.group_project_stages');
        if (stagesEnabled && !this.metaData.colorField) {
            this.metaData.colorField = COLOR_FIELD;
        }
        await super.load(searchParams);
    }
}
