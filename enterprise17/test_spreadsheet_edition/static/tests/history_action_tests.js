/** @odoo-module **/

import { registries, helpers } from "@odoo/o-spreadsheet";
import { createSpreadsheetTestAction } from "./utils/helpers";
import { waitForDataSourcesLoaded } from "@spreadsheet/../tests/utils/model";
import { getSpreadsheetActionModel } from "@spreadsheet_edition/../tests/utils/webclient_helpers";

import {
    editInput,
    click,
    patchWithCleanup,
    triggerEvent,
    nextTick,
} from "@web/../tests/helpers/utils";
const { topbarMenuRegistry } = registries;

const uuidGenerator = new helpers.UuidGenerator();

function createRevision(revisions, type, payload) {
    const len = revisions.length;
    const commands =
        type === "REMOTE_REVISION"
            ? [
                  {
                      sheetId: uuidGenerator.uuidv4(),
                      position: 0,
                      name: `sheet ${len + 2}`,
                      type: "CREATE_SHEET",
                  },
              ]
            : [];
    return {
        id: len + 1,
        name: `revision ${len + 1}`,
        serverRevisionId: revisions.at(-1)?.nextRevisionId || "START_REVISION",
        nextRevisionId: uuidGenerator.uuidv4(),
        version: "1",
        timestamp: "2023-09-09 13:00:00",
        user: [2, "Superman"],
        type,
        commands,
        ...payload,
    };
}

/**
 * 
 * @param {SpreadsheetAction} action 
 * @returns {Model}
 */
function actionModel(action) {
     return getSpreadsheetActionModel(action);
}

QUnit.module("Spreadsheet Test History Action", {}, function () {
    QUnit.test("Open history version from the menu", async function (assert) {
        const { env } = await createSpreadsheetTestAction(
            "spreadsheet_test_action"
        );
        patchWithCleanup(env.services.action, {
            doAction(action) {
                assert.step(JSON.stringify(action));
            },
        });
        const file = topbarMenuRegistry
            .getAll()
            .find((item) => item.id === "file");
        const showHistory = file.children.find(
            (item) => item.id === "version_history"
        );
        await showHistory.execute(env);
        assert.verifySteps([
            JSON.stringify({
                type: "ir.actions.client",
                tag: "action_open_spreadsheet_history",
                params: {
                    spreadsheet_id: 1,
                    res_model: "spreadsheet.test",
                },
            }),
        ]);
    });

    QUnit.test("load from the origin value", async function (assert) {
        await createSpreadsheetTestAction("action_open_spreadsheet_history", {
            mockRPC: async function (route, args) {
                if (args.method === "get_spreadsheet_history") {
                    assert.step(`fromSnapshot-${args.args[1]}`);
                }
            },
        });
        assert.verifySteps(["fromSnapshot-false"]);
    });

    QUnit.test("load action from snapshot", async function (assert) {
        await createSpreadsheetTestAction("action_open_spreadsheet_history", {
            mockRPC: async function (route, args) {
                if (args.method === "get_spreadsheet_history") {
                    assert.step(`fromSnapshot-${args.args[1]}`);
                }
            },
            fromSnapshot: true,
        });
        assert.verifySteps(["fromSnapshot-true"]);
    });

    QUnit.test(
        "load from snapshot when missing revisions",
        async function (assert) {
            await createSpreadsheetTestAction(
                "action_open_spreadsheet_history",
                {
                    mockRPC: async function (route, args) {
                        if (args.method === "get_spreadsheet_history") {
                            assert.step(`fromSnapshot-${args.args[1]}`);
                            return {
                                data: {},
                                name: "test",
                                revisions: [
                                    createRevision([], "REMOTE_REVISION", {
                                        serverRevisionId: "wrong revision id",
                                    }),
                                ],
                            };
                        }
                        if (args.method === "action_edit") {
                            assert.step(`editAction-${args.model}`);
                            return {
                                type: "ir.actions.client",
                                tag: "spreadsheet_test_action",
                                params: {
                                    spreadsheet_id: 1,
                                },
                            };
                        }
                    },
                }
            );
            assert.verifySteps(["fromSnapshot-false"]);

            let dialog = document.querySelector(".o_dialog");
            assert.ok(dialog !== null, "Dialog to reload with snapshot opened");
            await click(dialog, "button.btn-primary");
            assert.verifySteps(["fromSnapshot-true"]);
            await nextTick();
            dialog = document.querySelector(".o_dialog");
            assert.ok(dialog !== null, "Dialog to warn user of corrupted data");
            await click(dialog, "button.btn-primary");
            assert.verifySteps(["editAction-spreadsheet.test"]);
        }
    );

    QUnit.test("Side panel content", async function (assert) {
        await createSpreadsheetTestAction("action_open_spreadsheet_history", {
            mockRPC: async function (route, args) {
                if (args.method === "get_spreadsheet_history") {
                    const revisions = [];
                    revisions.push(
                        createRevision(revisions, "REMOTE_REVISION", {
                            name: "",
                        })
                    );
                    revisions.push(
                        createRevision(revisions, "REMOTE_REVISION")
                    );
                    revisions.push(
                        createRevision(revisions, "REMOTE_REVISION", {
                            user: [3, "Supergirl"],
                        })
                    );
                    return {
                        data: {},
                        name: "test",
                        revisions,
                    };
                }
            },
        });
        const revisions = document.querySelectorAll(
            ".o-version-history-wrapper .o-version-history-item"
        );
        assert.strictEqual(revisions.length, 3, "3 revisions provided");

        // Revision info
        assert.equal(
            revisions[0].querySelector(".o-version-history-info").textContent,
            "Current Version"
        );
        assert.equal(
            revisions[1].querySelector(".o-version-history-info").textContent,
            "Sep 9, 2023, 2:00 PM",
            "if the revision has a name"
        );
        assert.notOk(
            revisions[2].querySelector(".o-version-history-info"),
            "if the revision has no name"
        );

        // Revision name
        assert.equal(
            revisions[0].querySelector(".o-version-history-item-text input")
                .value,
            "revision 3",
            "if the revision has a name"
        );
        assert.equal(
            revisions[1].querySelector(".o-version-history-item-text input")
                .value,
            "revision 2",
            "if the revision has a name"
        );
        assert.equal(
            revisions[2].querySelector(".o-version-history-item-text input")
                .value,
            "Sep 9, 2023, 2:00 PM",
            "if the revision does not have a name"
        );

        // contributors
        assert.equal(
            revisions[0].querySelector(".o-version-history-item-text input")
                .value,
            "revision 3",
            "if the revision has a name"
        );
        assert.equal(
            revisions[1].querySelector(".o-version-history-item-text input")
                .value,
            "revision 2",
            "if the revision has a name"
        );
        assert.equal(
            revisions[2].querySelector(".o-version-history-item-text input")
                .value,
            "Sep 9, 2023, 2:00 PM",
            "if the revision does not have a name"
        );
    });

    QUnit.test(
        "Side panel click loads the old version",
        async function (assert) {
            const { action } = await createSpreadsheetTestAction(
                "action_open_spreadsheet_history",
                {
                    mockRPC: async function (route, args) {
                        if (args.method === "get_spreadsheet_history") {
                            const revisions = [];
                            revisions.push(
                                createRevision(revisions, "REMOTE_REVISION")
                            );
                            revisions.push(
                                createRevision(revisions, "REMOTE_REVISION")
                            );
                            return {
                                data: {},
                                name: "test",
                                revisions,
                            };
                        }
                    },
                }
            );
            assert.strictEqual(actionModel(action).getters.getSheetIds().length, 3);
            const revisions = document.querySelectorAll(
                ".o-version-history-wrapper .o-version-history-item"
            );
            // rollback to the before last revision. i.e. undo a CREATE_SHEET
            await click([...revisions].at(-1));
            await nextTick();
            assert.strictEqual(actionModel(action).getters.getSheetIds().length, 2);
        }
    );

    QUnit.test(
        "Side panel arrow keys navigates in the history",
        async function (assert) {
            const { action } = await createSpreadsheetTestAction(
                "action_open_spreadsheet_history",
                {
                    mockRPC: async function (route, args) {
                        if (args.method === "get_spreadsheet_history") {
                            const revisions = [];
                            revisions.push(
                                createRevision(revisions, "REMOTE_REVISION")
                            );
                            revisions.push(
                                createRevision(revisions, "REMOTE_REVISION")
                            );
                            revisions.push(
                                createRevision(revisions, "REMOTE_REVISION")
                            );
                            return {
                                data: {},
                                name: "test",
                                revisions,
                            };
                        }
                    },
                }
            );

            assert.strictEqual(actionModel(action).getters.getSheetIds().length, 4);
            const target = () => document.querySelector(".o-version-history");
            await triggerEvent(target(), null, "keydown", { key: "ArrowDown" });
            await nextTick();
            assert.strictEqual(actionModel(action).getters.getSheetIds().length, 3);
            await triggerEvent(target(), null, "keydown", { key: "ArrowDown" });
            await nextTick();
            assert.strictEqual(actionModel(action).getters.getSheetIds().length, 2);
            await triggerEvent(target(), null, "keydown", { key: "ArrowUp" });
            await nextTick();
            assert.strictEqual(actionModel(action).getters.getSheetIds().length, 3);
            await triggerEvent(target(), null, "keydown", { key: "ArrowUp" });
            await nextTick();
            assert.strictEqual(actionModel(action).getters.getSheetIds().length, 4);
        }
    );

    QUnit.test("Load more revisions", async function (assert) {
        await createSpreadsheetTestAction("action_open_spreadsheet_history", {
            mockRPC: async function (route, args) {
                if (args.method === "get_spreadsheet_history") {
                    const revisions = [];
                    for (let i = 0; i < 75; i++) {
                        revisions.push(
                            createRevision(revisions, "REMOTE_REVISION")
                        );
                    }
                    return {
                        data: {},
                        name: "test",
                        revisions,
                    };
                }
            },
        });
        const revisions = document.querySelectorAll(
            ".o-version-history-wrapper .o-version-history-item"
        );
        assert.strictEqual(
            revisions.length,
            50,
            "the first 50 revisions are loaded"
        );
        const loadMore = document.querySelector(
            ".o-version-history-wrapper .o-version-history-load-more"
        );
        assert.ok(loadMore !== null, "Load more button is visible");
        await click(loadMore);
        const newRevisions = document.querySelectorAll(
            ".o-version-history-wrapper .o-version-history-item"
        );
        assert.strictEqual(
            newRevisions.length,
            75,
            "the first 50 revisions are loaded"
        );
    });

    QUnit.test("Side panel > make copy", async function (assert) {
        await createSpreadsheetTestAction("action_open_spreadsheet_history", {
            mockRPC: async function (route, args) {
                switch (args.method) {
                    case "get_spreadsheet_history":
                        const revisions = [];
                        revisions.push(
                            createRevision(revisions, "REMOTE_REVISION", {
                                id: 999,
                                nextRevisionId: "I clicked o",
                            })
                        );
                        revisions.push(
                            createRevision(revisions, "REMOTE_REVISION")
                        );
                        return {
                            data: {},
                            name: "test",
                            revisions,
                        };
                    case "fork_history":
                        assert.strictEqual(args.kwargs.revision_id, 999);
                        assert.strictEqual(
                            args.kwargs.spreadsheet_snapshot.revisionId,
                            "I clicked o"
                        );
                        assert.step("forking");
                        // placeholder return
                        return {
                            type: "ir.actions.client",
                            tag: "reload",
                        };
                    default:
                        break;
                }
            },
        });

        const revisions = document.querySelectorAll(
            ".o-version-history-wrapper .o-version-history-item"
        );
        await click(revisions[1], null);
        await nextTick();
        await click(document.querySelector(".o-version-history-wrapper .o-version-history-item .o-dropdown .dropdown-toggle"));
        const dropdownItems = document.querySelectorAll(".o-version-history-wrapper .o-version-history-item .o-dropdown .dropdown-item");
        await click(dropdownItems[1], null);
        assert.verifySteps(["forking"]);
    });

    QUnit.test("Side panel > rename revision", async function (assert) {
        await createSpreadsheetTestAction("action_open_spreadsheet_history", {
            mockRPC: async function (route, args) {
                if (args.method === "get_spreadsheet_history") {
                    return {
                        data: {},
                        name: "test",
                        revisions: [createRevision([], "REMOTE_REVISION")],
                    };
                }
                if (args.method === "rename_revision") {
                    assert.equal(args.args[0], 1); // spreadsheet Id
                    assert.equal(args.args[1], 1); // revision id
                    assert.equal(args.args[2], "test 11");
                    return true;
                }
            },
        });
        const nameInput = document.querySelector(".o-version-history-input");
        assert.ok(nameInput, "Can rename the revision");
        await click(nameInput);
        await editInput(nameInput, null, "test 11");
        await triggerEvent(nameInput, null, "focusout");
    });

    QUnit.test(
        "closing side panel rolls back to parent action",
        async function (assert) {
            await createSpreadsheetTestAction(
                "action_open_spreadsheet_history",
                {
                    mockRPC: async function (route, args) {
                        if (args.method === "get_spreadsheet_history") {
                            return {
                                data: {},
                                name: "test",
                                revisions: [
                                    createRevision([], "REMOTE_REVISION"),
                                ],
                            };
                        }
                        if (args.method === "action_edit") {
                            assert.step(`editAction-${args.model}`);
                            return {
                                type: "ir.actions.client",
                                tag: "spreadsheet_test_action",
                                params: {
                                    spreadsheet_id: 1,
                                },
                            };
                        }
                    },
                }
            );
            await click(document, ".o-version-history-wrapper div.header>div:nth-child(2)");
            assert.verifySteps(["editAction-spreadsheet.test"]);
        }
    );

    QUnit.test("Undo/redo revisions are rolled back", async function (assert) {
        const { action } = await createSpreadsheetTestAction(
            "action_open_spreadsheet_history",
            {
                mockRPC: async function (route, args) {
                    if (args.method === "get_spreadsheet_history") {
                        const revisions = [];
                        revisions.push(
                            createRevision(revisions, "REMOTE_REVISION", { name: "Create sheet" })
                        );
                        const originalRevId = revisions.at(-1).nextRevisionId;
                        revisions.push(
                            createRevision(
                                revisions,
                                "REVISION_UNDONE",
                                {
                                    name: "Undo sheet creation",
                                    commands: undefined,
                                    undoneRevisionId: originalRevId
                                }
                            )
                        );
                        revisions.push(
                            createRevision(
                                revisions,
                                "REVISION_REDONE",
                                {
                                    name: "Redo sheet creation",
                                    commands: undefined,
                                    redoneRevisionId: originalRevId
                                }
                            )
                        );
                        return { data: {}, name: "test", revisions };
                    }
                },
            }
        );
        assert.strictEqual(actionModel(action).getters.getSheetIds().length, 2);
        const target = () => document.querySelector(".o-version-history");
        await triggerEvent(target(), null, "keydown", { key: "ArrowDown" });
        await nextTick();
        assert.strictEqual(actionModel(action).getters.getSheetIds().length, 1);
        await triggerEvent(target(), null, "keydown", { key: "ArrowDown" });
        await nextTick();
        assert.strictEqual(actionModel(action).getters.getSheetIds().length, 2);
        await triggerEvent(target(), null, "keydown", { key: "ArrowUp" });
        await nextTick();
        assert.strictEqual(actionModel(action).getters.getSheetIds().length, 1);
        await triggerEvent(target(), null, "keydown", { key: "ArrowUp" });
        await nextTick();
        assert.strictEqual(actionModel(action).getters.getSheetIds().length, 2);
    });

    QUnit.test("Datasources are re-evaluated if their domain is altered", async function (assert) {
        const { action } = await createSpreadsheetTestAction(
            "action_open_spreadsheet_history",
            {
                mockRPC: async function (route, args) {
                    if (args.method === "get_spreadsheet_history") {
                        const revisions = [];
                        revisions.push(
                            createRevision(revisions, "REMOTE_REVISION", { name: "Create sheet" })
                        );
                        revisions.push(
                            createRevision(
                                revisions,
                                "REMOTE_REVISION",
                                {
                                    name: "edit list definition",
                                    commands: [{
                                        "listId": "1",
                                        "domain": [["name", "=", "test"]],
                                        "type": "UPDATE_ODOO_LIST_DOMAIN"
                                    }],
                                }
                            )
                        );
                        return {
                            data: {
                                version: 14,
                                sheets: [
                                    {
                                        id: "sh1",
                                        name: "Sheet 1",
                                        cells: {
                                            A1: { content: '=ODOO.LIST(1,1,"name")' },
                                        },
                                    },
                                ],
                                lists: {
                                    1: {
                                        columns: ["name"],
                                        domain: [["name", "=", "tabouret"]],
                                        model: "partner",
                                        context: {},
                                        orderBy: [],
                                        id: "1",
                                        name: "Pipeline",
                                        fieldMatching: {}
                                    }
                                },
                            },
                            name: "test",
                            revisions,
                        };
                    }
                    if (args.method === "web_search_read") {
                        assert.step(JSON.stringify(args.kwargs.domain));
                    }
                },
            }
        );
        assert.deepEqual(actionModel(action).getters.getListDefinition("1").domain, [["name", "=", "test"]]);
        const target = () => document.querySelector(".o-version-history");
        await triggerEvent(target(), null, "keydown", { key: "ArrowDown" });
        await nextTick();
        await waitForDataSourcesLoaded(actionModel(action));
        assert.deepEqual(actionModel(action).getters.getListDefinition("1").domain, [["name", "=", "tabouret"]]);
        await triggerEvent(target(), null, "keydown", { key: "ArrowUp" });
        await nextTick();
        await waitForDataSourcesLoaded(actionModel(action));
        assert.deepEqual(actionModel(action).getters.getListDefinition("1").domain, [["name", "=", "test"]]);
        assert.verifySteps([`[["name","=","test"]]`, `[["name","=","tabouret"]]`, `[["name","=","test"]]`]);
    });

    QUnit.test("Selection and scroll are preserved when switching revision", async function (assert) {
        const { action } = await createSpreadsheetTestAction(
            "action_open_spreadsheet_history",
            {
                mockRPC: async function (route, args) {
                    if (args.method === "get_spreadsheet_history") {
                        const revisions = [];
                        revisions.push(
                            createRevision(revisions, "REMOTE_REVISION")
                        );
                        revisions.push(
                            createRevision(revisions, "REMOTE_REVISION")
                        );
                        revisions.push(
                            createRevision(revisions, "REMOTE_REVISION")
                        );
                        return { data: {}, name: "test", revisions };
                    }
                },
            }
        );
        let model = actionModel(action);
        const sheetIds = model.getters.getSheetIds();
        model.dispatch("ACTIVATE_SHEET", { sheetIdFrom: model.getters.getActiveSheetId(), sheetIdTo: sheetIds[2] });
        model.selection.selectCell(5, 5);
        model.dispatch("SET_VIEWPORT_OFFSET", { offsetX: 30, offsetY: 30 });
        await nextTick();
        const revisions = document.querySelectorAll(
            ".o-version-history-wrapper .o-version-history-item"
        );
        // rollback to the before last revision. i.e. undo a CREATE_SHEET in the first spot
        // -> the first sheet is deleted
        await click(revisions[1], null);
        await nextTick();
        await nextTick();
        model = actionModel(action);

        assert.deepEqual(model.getters.getActivePosition(), { sheetId: sheetIds[2], row: 5, col: 5 });
        assert.deepEqual(model.getters.getActiveSheetDOMScrollInfo(), { scrollX: 30, scrollY: 30 });
    });
});
