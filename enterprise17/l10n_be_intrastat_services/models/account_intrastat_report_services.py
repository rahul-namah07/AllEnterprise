# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models
from odoo.osv import expression
from odoo.tools.float_utils import float_round

from psycopg2.sql import SQL


class AccountIntrastatServicesBEReportHandler(models.AbstractModel):
    _inherit = 'account.intrastat.services.report.handler'
    _name = 'account.intrastat.services.be.report.handler'
    _description = 'Intrastat BE Services Report Custom Handler'

    def _custom_options_initializer(self, report, options, previous_options):
        super()._custom_options_initializer(report, options, previous_options)
        if options.get('selected_variant_id') == self.env.ref('l10n_be_intrastat_services.intrastat_report_services_f01dgs').id:
            options['l10n_be_variant'] = 'F01DGS'
        else:
            options['l10n_be_variant'] = 'F02CMS'

    @api.model
    def _build_query_group(self, options, column_group_key=None, query_params=None):
        inner_query, params = self._prepare_query(options)
        query = SQL(
                """
            SELECT intrastat_lines.commodity_code AS commodity_code,
                   intrastat_lines.country_code AS country_code,
                   intrastat_lines.invoice_currency_name as invoice_currency_name,
                   SUM(CASE WHEN "system" = '29' THEN value ELSE 0 END) as income,
                   SUM(CASE WHEN "system" = '19' THEN value ELSE 0 END) as expense
              FROM ({inner_query}) intrastat_lines
        INNER JOIN account_move ON account_move.id = intrastat_lines.invoice_id
          GROUP BY country_code, commodity_code, invoice_currency_name
                """
            ).format(inner_query=inner_query)
        return query, params

    @api.model
    def _get_xml_file_content(self, options, query_res):
        return self.env['ir.qweb']._render('l10n_be_intrastat_services.intrastat_services_report_export_xml', {
            'company': self.env.company,
            'items': query_res,
            'date': fields.Date.to_date(options['date']['date_from']).strftime('%Y-%m'),
            'code': options['l10n_be_variant'],
            'form': options['l10n_be_variant'],
        })

    @api.model
    def _get_csv_file_content(self, options, query_res):
        file_content = ''
        for result in query_res:
            # The amount is expressed in EUR, even if the transaction is in another currency and
            # said currency is specified in the report.
            # The BNB spec is not clear about this, but every amount is in EUR in any other
            # belgian intrastat report so we assume it's the case here too.
            file_content += ';'.join([
                result['commodity_code'],
                result['country_code'],
                result['invoice_currency_name'],
                str(int(float_round(result['income'], 0))),
                str(int(float_round(result['expense'], 0))),
            ]) + '\n'
        return file_content

    @api.model
    def _prepare_query(self, options, column_group_key=None, expanded_line_options=None, offset=0, limit=None, order_by=True, query_params=None):
        """ In the F01DGS declaration, the amounts deducted (credit notes, …) must be listed for each
        heading not only under the ordinary heading, but also separately under the corresponding
        heading ending with CN (entitled “of which amounts deducted (credit notes, …)”).
        Example:
        10/01/2024: company A in Belgium receives from company B in Argentina an invoice for sea
        transport of passengers for the amount of 500.000 €.
        20/02/2024: company A in Belgium receives from company B in Argentina a credit note on the
        invoice of 01/2024 for an amount of 20.000 €.
        In the F01DGS declaration for January 2024, company A therefore indicates the following:
        ┌─────────┬─────────┬──────────────┬──────────┬───────────────┬─────────────────┐
        │ Period  │ Heading │ Country code │ Currency │ Income amount │ Expenses amount │
        ╞═════════╪═════════╪══════════════╪══════════╪═══════════════╪═════════════════╡
        │ 01/2024 │ B2001   │ AR           │ EUR      │               │ 500 000         │
        └─────────┴─────────┴──────────────┴──────────┴───────────────┴─────────────────┘
        For February 2024, company A indicates the following:
        ┌─────────┬─────────┬──────────────┬──────────┬───────────────┬─────────────────┐
        │ Period  │ Heading │ Country code │ Currency │ Income amount │ Expenses amount │
        ╞═════════╪═════════╪══════════════╪══════════╪═══════════════╪═════════════════╡
        │ 02/2024 │ B2001   │ AR           │ EUR      │ 20 000        │                 │
        │ 02/2024 │ B2001CN │ AR           │ EUR      │ 20 000        │                 │
        └─────────┴─────────┴──────────────┴──────────┴───────────────┴─────────────────┘
        The amounts deducted included in heading B2001 “Sea transport of passengers” on the income
        side must also be stated separately in the corresponding heading B2001CN on the income side.
        These headings ending with CN are not applicable in the declaration F02CMS.

        Source: https://www.nbb.be/doc/dd/onegate/data/f01dgs-f02cms_manual_en.pdf
        """

        query_params = {
            **(query_params or {}),
            'country_table_join': SQL(
                "LEFT JOIN res_country country ON account_move.intrastat_country_id = country.id "
                "OR partner.country_id = country.id"
            ),
            'country_condition': SQL(""),
        }

        if (
            options.get('l10n_be_variant') != 'F01DGS' or
            # if it's an expanded line, an the parent is not CN, nothing to do
            (expanded_line_options and not expanded_line_options['commodity_code'].endswith('CN'))
        ):
            return super()._prepare_query(
                options, column_group_key, expanded_line_options, offset, limit, order_by, query_params,
            )

        is_refund_domain = [('move_id.move_type', 'in', ('in_refund', 'out_refund'))]
        if expanded_line_options:
            query_params['commodity_code'] = SQL("concat(code.code, 'CN')")
            expanded_line_options = {
                **expanded_line_options,
                'commodity_code': expanded_line_options['commodity_code'][:-2],  # remove 'CN'
            }
            options['forced_domain'] = expression.AND([options['forced_domain'], is_refund_domain])
            query, where_params = super()._prepare_query(
                options, column_group_key, expanded_line_options, offset, limit, order_by, query_params,
            )
        else:
            # add CN lines
            normal_lines_query, where_params = super()._prepare_query(
                options, column_group_key, expanded_line_options, offset=0, limit=None, order_by=False, query_params=query_params,
            )
            options['forced_domain'] = expression.AND([options.get('forced_domain') or [], is_refund_domain])
            query_params['commodity_code'] = SQL("concat(code.code, 'CN')")
            cn_lines_query, cn_where_params = super()._prepare_query(
                options, column_group_key, expanded_line_options, offset=0, limit=None, order_by=False, query_params=query_params,
            )
            query = SQL(" UNION ").join([normal_lines_query, cn_lines_query])
            where_params += cn_where_params
        if offset or limit:
            tail_query, tail_params = self.env['account.report']._get_engine_query_tail(offset, limit)
            query += SQL(tail_query)
            where_params += tail_params

        return query, where_params
