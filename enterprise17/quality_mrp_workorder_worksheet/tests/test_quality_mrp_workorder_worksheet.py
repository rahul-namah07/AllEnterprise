# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import Command
from odoo.addons.quality_control.tests.test_common import TestQualityCommon
from odoo.tests import Form


class TestQualityMRPWorkorderWorksheet(TestQualityCommon):

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.worksheet_template = cls.env['worksheet.template'].create({
            'name': 'Quality worksheet',
            'res_model': 'quality.check',
        })

    def test_check_worksheet_workorder_no_shop_floor(self):
        """ If a worksheet quality check is performed in the backend, the worksheet's pass/fail
        conditions should be followed.
        """
        finished_product = self.product
        bom = self.env['mrp.bom'].create({
            'product_tmpl_id': finished_product.product_tmpl_id.id,
            'product_qty': 1,
            'type': 'normal',
            'bom_line_ids': [
                Command.create({'product_id': self.product_2.id, 'product_qty': 1}),
                Command.create({'product_id': self.product_3.id, 'product_qty': 1}),
            ],
        })
        operation = self.env['mrp.routing.workcenter'].create({
            'name': 'op1',
            'workcenter_id': self.env['mrp.workcenter'].create({'name': 'workcenter1'}).id,
            'bom_id': bom.id,
        })
        bom.operation_ids = [Command.link(operation.id)]
        quality_point = self.env['quality.point'].create({
            'title': 'point1',
            'product_ids': [Command.link(finished_product.id)],
            'operation_id': operation.id,
            'measure_on': 'operation',
            'measure_frequency_type': 'all',
            'test_type_id': self.env.ref('quality_control_worksheet.test_type_worksheet').id,
            'worksheet_template_id': self.worksheet_template.id,
            'worksheet_success_conditions': '[(\'x_passed\', \'=\', True)]',
        })
        mo = self.env['mrp.production'].create({
            'product_id': finished_product.id,
            'product_qty': 1,
        })
        mo.action_confirm()
        quality_check = quality_point.check_ids[0]
        quality_worksheet_action = quality_check.action_quality_worksheet()
        worksheet_form = Form(self.env[quality_worksheet_action['res_model']].browse(quality_worksheet_action['res_id']))
        worksheet_form.x_passed = False
        worksheet_form.x_quality_check_id = quality_check
        worksheet_form.save()
        quality_check.action_worksheet_check()
        self.assertEqual(quality_check.quality_state, 'fail')
