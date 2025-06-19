# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import Command
from odoo.tests import tagged
from odoo.addons.stock_barcode.tests.test_barcode_client_action import TestBarcodeClientAction
from odoo.addons.quality_control.tests.test_common import TestQualityCommon


@tagged('post_install', '-at_install')
class TestBarcodeQualityControlClientAction(TestBarcodeClientAction, TestQualityCommon):

    def test_operation_quality_check_barcode(self):
        """
        Test quality check on incoming shipment from barcode.

        Note that the situation is quite different from the outgoing
        shipment flows since creating an incoming shipment on the
        fly form barcode will end up with a draft picking that
        will be confirmed at the start of the button_validate.
        """

        # Create Quality Point for incoming shipments.
        quality_points = self.env['quality.point'].create([
            {
                'title': "check product 1",
                'measure_on': "operation",
                'product_ids': [Command.link(self.product1.id)],
                'picking_type_ids': [Command.link(self.picking_type_in.id)],
            },
            {
                'title': "check product 2",
                'measure_on': "operation",
                'product_ids': [Command.link(self.product2.id)],
                'picking_type_ids': [Command.link(self.picking_type_in.id)],
            },
        ])
        action_id = self.env.ref('stock_barcode.stock_barcode_action_main_menu')
        url = "/web#action=" + str(action_id.id)

        self.start_tour(url, 'test_operation_quality_check_barcode', login='admin', timeout=180)

        quality_checks = self.env['quality.check'].search([('point_id', 'in', quality_points.ids)])
        self.assertRecordValues(quality_checks.sorted('title'), [
            {'title': 'check product 1', 'quality_state': 'pass'},
            {'title': 'check product 2', 'quality_state': 'fail'},
        ])
        self.assertEqual(quality_checks.picking_id.state, "done")

    def test_operation_quality_check_delivery_barcode(self):
        """
        Test quality check on outgoing shipment from barcode.

        Note that the situation is quite different from the incoming
        shipment flows since creating an outgoing shipment on the
        fly form the barcode will end up with an assinged picking that
        has never been confirmed and hence will NOT be confirmed
        during the button_validate.
        """

        # Create Quality point for deliveries.
        quality_points = self.env['quality.point'].create([
            {
                'title': "check product 1",
                'measure_on': "operation",
                'product_ids': [Command.link(self.product1.id)],
                'picking_type_ids': [Command.link(self.picking_type_out.id)],
            },
            {
                'title': "check product 2",
                'measure_on': "operation",
                'product_ids': [Command.link(self.product2.id)],
                'picking_type_ids': [Command.link(self.picking_type_out.id)],
            },
        ])
        action_id = self.env.ref('stock_barcode.stock_barcode_action_main_menu')
        url = "/web#action=" + str(action_id.id)

        self.start_tour(url, 'test_operation_quality_check_delivery_barcode', login='admin', timeout=180)

        quality_checks = self.env['quality.check'].search([('point_id', 'in', quality_points.ids)])
        self.assertRecordValues(quality_checks.sorted('title'), [
            {'title': 'check product 1', 'quality_state': 'pass'},
            {'title': 'check product 2', 'quality_state': 'fail'},
        ])
        self.assertEqual(quality_checks.picking_id.state, "done")
