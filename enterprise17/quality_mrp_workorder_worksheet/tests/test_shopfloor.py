# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo import Command

from odoo.tests.common import HttpCase, tagged
from odoo.addons.quality_control_worksheet.tests.test_quality_worksheet import TestQualityWorksheet

@tagged('post_install', '-at_install')
class TestShopFloorWorksheet(HttpCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.worksheet_template = cls.env['worksheet.template'].create({
            'name': 'Lovely worksheet',
            'res_model': 'quality.check',
        })

    def test_worksheet_quality_check(self):
        warehouse = self.env.ref("stock.warehouse0")
        final_product, component = self.env['product.product'].create([
            {
                'name': 'Lovely Product',
                'type': 'product',
                'tracking': 'none',
            },
            {
                'name': 'Lovely Component',
                'type': 'product',
                'tracking': 'none',
            },
        ])
        self.env['stock.quant']._update_available_quantity(component, warehouse.lot_stock_id, quantity=10)
        workcenter = self.env['mrp.workcenter'].create({
            'name': 'Lovely Workcenter',
        })
        bom = self.env['mrp.bom'].create({
            'product_tmpl_id': final_product.product_tmpl_id.id,
            'product_qty': 1.0,
            'operation_ids': [
                Command.create({'name': 'Lovely Operation', 'workcenter_id': workcenter.id}),
            ],
            'bom_line_ids': [
                Command.create({'product_id': component.id, 'product_qty': 1.0}),
            ]
        })
        self.env['quality.point'].create([
            {
                'picking_type_ids': [Command.link(warehouse.manu_type_id.id)],
                'product_ids': [Command.link(final_product.id)],
                'operation_id': bom.operation_ids.id,
                'title': 'Lovely Worksheet',
                'product_ids': final_product.ids,
                'test_type_id': self.ref('quality_control_worksheet.test_type_worksheet'),
                'worksheet_template_id': self.worksheet_template.id,
                'sequence': 1,
            },
        ])
        mo = self.env['mrp.production'].create({
            'product_id': final_product.id,
            'product_qty': 1,
            'bom_id': bom.id,
        })
        mo.action_confirm()
        mo.action_assign()
        self.assertEqual(mo.reservation_state, 'assigned')
        mo.button_plan()
        action = self.env["ir.actions.actions"]._for_xml_id("mrp_workorder.action_mrp_display")
        url = '/web?#action=%s' % (action['id'])
        self.start_tour(url, "test_worksheet_quality_check", login='admin')
        self.assertEqual(mo.workorder_ids.state, "done")
