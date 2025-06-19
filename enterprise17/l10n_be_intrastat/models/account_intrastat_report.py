# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _
from odoo.exceptions import RedirectWarning
from odoo.tools.float_utils import float_round

from lxml import etree


class IntrastatReportCustomHandler(models.AbstractModel):
    _inherit = 'account.intrastat.report.handler'

    def _custom_options_initializer(self, report, options, previous_options):
        super()._custom_options_initializer(report, options, previous_options)

        if self.env.company.account_fiscal_country_id.code != 'BE':
            return

        options['buttons'].extend([
            {
                'name': _('XML'),
                'sequence': 30,
                'action': 'export_file',
                'action_param': 'be_intrastat_export_to_xml',
                'file_export_type': _('XML'),
            },
            {
                'name': _('CSV'),
                'sequence': 40,
                'action': 'export_file',
                'action_param': 'be_intrastat_export_to_csv',
                'file_export_type': _('CSV'),
            },
        ])
        options['intrastat_grouped'] = previous_options.get('intrastat_grouped', True)

    def _show_region_code(self):
        if self.env.company.account_fiscal_country_id.code == 'BE' and not self.env.company.intrastat_region_id:
            return False
        return super()._show_region_code()

    @api.model
    def _get_report_lines(self, options):

        company = self.env.company
        if not company.company_registry:
            error_msg = _('Missing company registry information on the company')
            action_error = {
                'name': _('company %s', company.name),
                'type': 'ir.actions.act_window',
                'view_mode': 'form',
                'res_model': 'res.company',
                'views': [[False, 'form']],
                'target': 'new',
                'res_id': company.id,
            }
            raise RedirectWarning(error_msg, action_error, _('Add company registry'))

        self.env.cr.flush()
        query, params = self._build_query_group(options)
        self._cr.execute(query, params)  # pylint: disable=sql-injection
        query_res = self._cr.dictfetchall()
        query_res = self._fill_missing_values(query_res)
        return query_res

    @api.model
    def _get_xml_file_content(self, options, query_res):
        # create in_vals (resp. out_vals) corresponding to invoices with cash-in (resp. cash-out)
        in_vals = []
        out_vals = []
        for result in query_res:
            in_vals.append(result) if result['type'] == 'Arrival' else out_vals.append(result)

        return self.env['ir.qweb']._render('l10n_be_intrastat.intrastat_report_export_xml', {
            'company': self.env.company,
            'in_vals': in_vals,
            'out_vals': out_vals,
            'extended': options.get('intrastat_extended'),
            'date': fields.Date.to_date(options['date']['date_from']).strftime('%Y-%m'),
            'incl_arrivals': options['intrastat_type'][0]['selected'] or not options['intrastat_type'][1]['selected'],
            'incl_dispatches': options['intrastat_type'][1]['selected'] or not options['intrastat_type'][0]['selected'],
            '_get_reception_code': self._get_reception_code,
            '_get_reception_form': self._get_reception_form,
            '_get_expedition_code': self._get_expedition_code,
            '_get_expedition_form': self._get_expedition_form,
        })

    @api.model
    def be_intrastat_export_to_xml(self, options):
        # Get report lines
        self._check_date_range(options)

        query_res = self._get_report_lines(options)
        file_content = self._get_xml_file_content(options, query_res)

        return {
            'file_name': self.env['account.report'].browse(options['report_id']).get_default_report_filename(options, 'xml'),
            'file_content': etree.tostring(etree.fromstring(file_content), xml_declaration=True, encoding='utf-8', pretty_print=True),
            'file_type': 'xml',
        }

    @api.model
    def _get_csv_file_content(self, options, query_res):
        file_content = ''
        base_columns = ['system', 'country_code', 'transaction_code', 'region_code', 'commodity_code',
                    'weight', 'supplementary_units', 'value']
        if options['intrastat_extended']:
            base_columns += ['transport_code', 'incoterm_code']
        system_29_columns = base_columns + ['intrastat_product_origin_country_code', 'partner_vat']
        for result in query_res:
            columns = system_29_columns if result['system'] == '29' else base_columns
            file_content += ';'.join([
                str(int(float_round(result.get(col) or 0, 0))) if col == 'value' else str(result.get(col) or '') for col in columns
            ]) + '\n'
        return file_content

    @api.model
    def be_intrastat_export_to_csv(self, options):
        self._check_date_range(options)
        # Get report lines
        query_res = self._get_report_lines(options)
        file_content = self._get_csv_file_content(options, query_res)
        return {
            'file_name': self.env['account.report'].browse(options['report_id'])
                .get_default_report_filename(options, 'csv'),
            'file_content': file_content,
            'file_type': 'csv',
        }

    def _get_reception_code(self, extended):
        return 'EX19E' if extended else 'EX19S'

    def _get_reception_form(self, extended):
        return 'EXF19E' if extended else 'EXF19S'

    def _get_expedition_code(self, extended):
        return 'INTRASTAT_X_E' if extended else 'INTRASTAT_X_S'

    def _get_expedition_form(self, extended):
        return 'INTRASTAT_X_EF' if extended else 'INTRASTAT_X_SF'
