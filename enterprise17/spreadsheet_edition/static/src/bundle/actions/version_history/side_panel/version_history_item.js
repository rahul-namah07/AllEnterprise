/** @odoo-module */

import { Component, useRef, useState, useEffect } from "@odoo/owl";
import { Dropdown } from "@web/core/dropdown/dropdown";
import { DropdownItem } from "@web/core/dropdown/dropdown_item";

import { formatToLocaleString } from "../../../helpers";
import { _t } from "@web/core/l10n/translation";
import { pyToJsLocale } from "@web/core/l10n/utils";


export class VersionHistoryItem extends Component {
    static template = "spreadsheet_edition.VersionHistoryItem";
    static components = { Dropdown, DropdownItem };
    static props = {
        active: Boolean,
        revision: Object,
        onActivation: Function,
        onBlur: Function,
        getRevisions: Function,
        renameRevision: Function,
        forkHistory: Function,
        getLocale: Function,
    };

    setup() {
        this.menuState = useState({ isOpen: false });
        this.state = useState({ editName: this.defaultName });
        this.inputRef = useRef("revisionName");
        this.menuButtonRef = useRef("menuButton");
        this.itemRef = useRef("item");

        useEffect(() => {
            if (this.props.active) {
                this.itemRef.el.scrollIntoView({
                    behavior: "smooth",
                    block: "nearest",
                    inline: "nearest",
                });
            }
        });
    }

    get revision() {
        return this.props.revision;
    }

    get defaultName() {
        return (
            this.props.revision.name || this.formatRevisionTimeStamp(this.props.revision.timestamp)
        );
    }

    get isLatestVersion() {
        return (
            this.props.getRevisions()[0].nextRevisionId === this.revision.nextRevisionId
        );
    }

    get dateValue() {
        return this.isLatestVersion
            ? _t("Current Version")
            : this.formatRevisionTimeStamp(this.props.revision.timestamp);
    }

    onKeyDown(ev) {
        switch (ev.key) {
            case "Enter":
                this.renameRevision();
                this.props.onBlur?.();
                break;
            case "Escape":
                this.state.editName = this.defaultName;
                this.props.onBlur?.();
                break;
        }
    }

    renameRevision() {
        if (!this.state.editName) {
            this.state.editName = this.defaultName;
        }
        if (this.state.editName !== this.defaultName) {
            this.props.renameRevision(this.revision.id, this.state.editName);
        }
    }

    get menuItems() {
        return [
            {
                name: this.revision.name ? _t("Rename") : _t("Name this version"),
                execute: () => this.inputRef.el.focus(),
                id: "rename_" + this.revision.id,
            },
            {
                name: _t("Make a copy"),
                execute: () => this.props.forkHistory(this.revision.id),
                id: "copy_" + this.revision.id,
            }
        ]
    }

    openMenu() {
        this.props.onActivation(this.revision.nextRevisionId);
    }

    formatRevisionTimeStamp(ISOdatetime) {
        const code = pyToJsLocale(this.props.getLocale().code);
        return formatToLocaleString(ISOdatetime, code);
    }
}
