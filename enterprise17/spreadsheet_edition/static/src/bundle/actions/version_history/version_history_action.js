/** @odoo-module **/
import { onMounted, onPatched, onWillStart, Component, useState } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { standardActionServiceProps } from "@web/webclient/actions/action_service";
import { _t } from "@web/core/l10n/translation";
import { pyToJsLocale } from "@web/core/l10n/utils";
import { registry } from "@web/core/registry";

import { UNTITLED_SPREADSHEET_NAME } from "@spreadsheet/helpers/constants";
import * as spreadsheet from "@odoo/o-spreadsheet";
import { DataSources } from "@spreadsheet/data_sources/data_sources";

import { loadSpreadsheetDependencies } from "@spreadsheet/assets_backend/helpers";
import { ConfirmationDialog } from "@web/core/confirmation_dialog/confirmation_dialog";

import { SpreadsheetComponent } from "../spreadsheet_component";
import { SpreadsheetControlPanel } from "../control_panel/spreadsheet_control_panel";
import { SpreadsheetName } from "../control_panel/spreadsheet_name";
import { VersionHistorySidePanel } from "./side_panel/version_history_side_panel";
import { migrate } from "@spreadsheet/o_spreadsheet/migration";
import {
    useSpreadsheetCurrencies,
    useSpreadsheetLocales,
    useSpreadsheetThumbnail,
} from "../../hooks";
import { formatToLocaleString } from "../../helpers";

const { Model } = spreadsheet;
export class VersionHistoryAction extends Component {
    setup() {
        this.params = this.props.action.params;
        this.orm = useService("orm");
        this.router = useService("router");
        this.dialog = useService("dialog");
        this.actionService = useService("action");
        this.resId = this.params.spreadsheet_id || (this.props.state && this.props.state.resId); // used when going back to a spreadsheet via breadcrumb
        this.resModel = this.params.res_model || (this.props.state && this.props.state.remoModel); // used when going back to a spreadsheet via breadcrumb
        this.fromSnapshot =
            this.params.from_snapshot || (this.props.state && this.props.state.fromSnapshot);
        this.loadLocales = useSpreadsheetLocales();
        this.loadCurrencies = useSpreadsheetCurrencies();
        this.getThumbnail = useSpreadsheetThumbnail();

        this.spreadsheetName = UNTITLED_SPREADSHEET_NAME;
        this.revisions = [];
        this.restorableRevisions = [];
        this.state = useState({
            currentRevisionId: null,
        });
        this.model = null;

        onWillStart(async () => {
            await this.fetchData();
            this.loadModel();
        });

        onMounted(() => {
            this.router.pushState({
                spreadsheet_id: this.resId,
                res_model: this.resModel,
                from_snapshot: this.fromSnapshot,
            });
            this.env.config.setDisplayName(this.spreadsheetName);
        });
        onPatched(() => {
            if (this.state.shouldReloadPosition) {
                // we need a frame for the spreadsheet component to compute its own size and adjust its dimensions

                setTimeout(() => {
                    const { col, row } = this.state.oldPosition;
                    const zone = { top: row, bottom: row, left: col, right: col };
                    const res = this.model.dispatch("ACTIVATE_SHEET", {
                        sheetIdFrom: this.model.getters.getActiveSheetId(),
                        sheetIdTo: this.state.oldPosition.sheetId,
                    });
                    if (res.isSuccessful) {
                        this.model.selection.selectZone(
                            { cell: { col, row }, zone },
                            { scrollIntoView: true }
                        );
                        this.model.dispatch("SET_VIEWPORT_OFFSET", {
                            offsetX: this.state.scroll.scrollX,
                            offsetY: this.state.scroll.scrollY,
                        });
                    }
                    this.state.shouldReloadPosition = false;
                }, 0);
            }
        });
    }

    restoreView() {
        if (!this.state.shouldReloadPosition) {
            return;
        }
        const { col, row } = this.state.oldPosition;
        const zone = { top: row, bottom: row, left: col, right: col };
        const res = this.model.dispatch("ACTIVATE_SHEET", {
            sheetIdFrom: this.model.getters.getActiveSheetId(),
            sheetIdTo: this.state.oldPosition.sheetId,
        });
        if (res.isSuccessful) {
            this.model.selection.selectZone({ cell: { col, row }, zone }, { scrollIntoView: true });
            this.model.dispatch("SET_VIEWPORT_OFFSET", {
                offsetX: this.state.scroll.scrollX,
                offsetY: this.state.scroll.scrollY,
            });
        }
        this.state.shouldReloadPosition = false;
    }

    getRevisions() {
        return this.restorableRevisions;
    }

    async renameRevision(revisionId, name) {
        this.revisions.find((el) => el.id === revisionId).name = name;
        this.generateRestorableRevisions();
        await this.orm.call(this.resModel, "rename_revision", [this.resId, revisionId, name]);
    }

    loadToRevision(revisionId) {
        if (revisionId === this.state.currentRevisionId) {
            return;
        }
        const scroll = this.model.getters.getActiveSheetDOMScrollInfo();
        const oldPosition = this.model.getters.getActivePosition();
        this.state.currentRevisionId = revisionId;
        this.loadModel();
        this.state.scroll = scroll;
        this.state.oldPosition = oldPosition;
        this.state.shouldReloadPosition = true;
    }

    async forkHistory(revisionId) {
        const data = this.model.exportData();
        const revision = this.revisions.find((rev) => rev.id === revisionId);
        data.revisionId = revision.nextRevisionId;
        const code = pyToJsLocale(this.model.getters.getLocale().code);
        const timestamp = formatToLocaleString(revision.timestamp, code);
        const name = _t("%(name)s (restored from %(timestamp)s)", {
            name: this.spreadsheetName,
            timestamp,
        });
        const defaultValues = {
            display_thumbnail: this.getThumbnail(),
            name,
        };
        const action = await this.orm.call(this.resModel, "fork_history", [this.resId], {
            revision_id: revisionId,
            spreadsheet_snapshot: data,
            default: defaultValues,
        });
        // Redirect to the forked spreadsheet
        this.actionService.doAction(action, { clearBreadcrumbs: true });
    }

    async fetchData() {
        const [spreadsheetHistoryData] = await Promise.all([
            this._fetchData(),
            loadSpreadsheetDependencies(),
        ]);
        this.spreadsheetData = spreadsheetHistoryData.data;
        this.revisions = spreadsheetHistoryData.revisions;
        this.generateRestorableRevisions();
        this.spreadsheetName = spreadsheetHistoryData.name;
        this.state.currentRevisionId =
            this.restorableRevisions[0]?.nextRevisionId ||
            spreadsheetHistoryData.data.revisionId ||
            "START_REVISION";
        this.setDatasources();
    }

    generateRestorableRevisions() {
        this.restorableRevisions = this.revisions
            .slice()
            .filter((el) => el.type !== "SNAPSHOT_CREATED")
            .reverse();
    }

    /**
     * @returns {Promise<SpreadsheetRecord>}
     */
    async _fetchData() {
        const record = await this.orm.call(this.resModel, "get_spreadsheet_history", [
            this.resId,
            !!this.fromSnapshot,
        ]);
        return record;
    }

    /**
     * @private
     */
    setDatasources() {
        if (this.dataSources) {
            this.dataSources.removeEventListener(
                "data-source-updated",
                this._dataSourceBind.bind(this)
            );
        }
        this.dataSources = new DataSources(this.env);
        this.dataSources.addEventListener("data-source-updated", this._dataSourceBind.bind(this));
    }

    /**
     * @private
     */
    _dataSourceBind() {
        const sheetId = this.model.getters.getActiveSheetId();
        this.model.dispatch("EVALUATE_CELLS", { sheetId });
    }

    reloadFromSnapshot() {
        this.actionService.doAction(
            {
                type: "ir.actions.client",
                tag: this.props.action.tag,
                params: {
                    spreadsheet_id: this.resId,
                    res_model: this.resModel,
                    from_snapshot: true,
                },
            },
            { clearBreadcrumbs: true }
        );
    }

    async loadEditAction() {
        const action = await this.env.services.orm.call(this.resModel, "action_edit", [this.resId]);
        this.actionService.doAction(action, {
            clearBreadcrumbs: true,
        });
    }

    get historyPanelProps() {
        return {
            getRevisions: this.getRevisions.bind(this),
            forkHistory: this.forkHistory.bind(this),
            renameRevision: this.renameRevision.bind(this),
            loadToRevision: this.loadToRevision.bind(this),
            getCurrentRevisionId: () => this.state.currentRevisionId,
            getLocale: () => this.model.getters.getLocale(),
            onCloseSidePanel: async () => {
                const action = await this.env.services.orm.call(this.resModel, "action_edit", [
                    this.resId,
                ]);
                this.env.services.action.doAction(action, {
                    clearBreadcrumbs: true,
                });
            },
        };
    }

    loadModel() {
        const revisionIndex = this.revisions.findIndex(
            (revision) => revision.nextRevisionId === this.state.currentRevisionId
        );
        const revisions = this.revisions.slice(0, revisionIndex + 1);
        this.setDatasources();
        const data = this.spreadsheetData;
        this.model = new Model(
            migrate(data),
            {
                custom: {
                    env: this.env,
                    orm: this.orm,
                    dataSources: this.dataSources,
                },
                external: {
                    loadCurrencies: this.loadCurrencies,
                    loadLocales: this.loadLocales,
                },
                mode: "readonly",
            },
            revisions
        );
        if (this.model.session.serverRevisionId !== this.state.currentRevisionId) {
            if (!this.fromSnapshot) {
                this.dialog.add(ConfirmationDialog, {
                    title: _t("Odoo Spreadsheet"),
                    body: _t(
                        "There are missing revisions that prevent to restore the whole edition history.\n\
Would you like to load the more recent modifications?"
                    ),
                    confirm: () => {
                        this.reloadFromSnapshot();
                    },
                    close: () => {
                        this.loadEditAction();
                    },
                });
            } else {
                this.dialog.add(ConfirmationDialog, {
                    title: _t("Odoo Spreadsheet"),
                    body: _t(
                        "The history of your spreadsheet is corrupted and you are likely missing recent revisions. This feature cannot be used."
                    ),
                    confirm: () => {
                        this.loadEditAction();
                    },
                });
            }
        }
        if (this.env.debug) {
            // eslint-disable-next-line no-import-assign
            spreadsheet.__DEBUG__ = spreadsheet.__DEBUG__ || {};
            spreadsheet.__DEBUG__.model = this.model;
        }
    }
}

VersionHistoryAction.template = "spreadsheet_edition.VersionHistoryAction";
VersionHistoryAction.components = {
    SpreadsheetComponent,
    SpreadsheetControlPanel,
    SpreadsheetName,
    VersionHistorySidePanel,
};
VersionHistoryAction.props = { ...standardActionServiceProps };
registry.category("actions").add("action_open_spreadsheet_history", VersionHistoryAction, {
    force: true,
});
