# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models
from psycopg2.sql import SQL


class AccountIntrastatServicesReportHandler(models.AbstractModel):
    _name = 'account.intrastat.services.report.handler'
    _inherit = 'account.intrastat.report.handler'
    _description = 'Intrastat Services Report Custom Handler'

    def _get_errors(self):
        return super()._get_errors() + ['expired_services', 'premature_services', 'missing_services']

    def _build_query_group(self, options, column_group_key=None, query_params=None):
        query_params = {**(query_params or {}), 'commodity_warning_suffix': SQL("services")}
        return super()._build_query_group(options, column_group_key, query_params)

    def _prepare_query(self, options, column_group_key=None, expanded_line_options=None, offset=0,
                       limit=None, order_by=True, query_params=None):
        query_params = {
            **(query_params or {}),
            'product_type_condition': SQL("AND prodt.type = 'service'"),
            'commodity_warning_suffix': SQL("services"),
            # prevent non service related warnings
            'missing_weights_warning': SQL("FALSE AS missing_weight,"),
            'missing_trans_code_warning': SQL("FALSE AS missing_trans,"),
        }
        return super()._prepare_query(options, column_group_key, expanded_line_options, offset,
                                      limit, order_by, query_params)
