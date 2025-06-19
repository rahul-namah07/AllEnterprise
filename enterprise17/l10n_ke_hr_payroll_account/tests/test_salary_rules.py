# Part of Odoo. See LICENSE file for full copyright and licensing details.

from datetime import date

from odoo.addons.account.tests.common import AccountTestInvoicingCommon
from odoo.tests.common import tagged
from odoo.tools import float_compare


@tagged('post_install', 'post_install_l10n', '-at_install', 'payslips_validation')
class TestPayslipValidation(AccountTestInvoicingCommon):

    @classmethod
    def setUpClass(cls, chart_template_ref='ke'):
        super().setUpClass(chart_template_ref=chart_template_ref)

        cls.ke_company = cls.env.ref('l10n_ke.demo_company_ke')

        cls.env.user.company_ids |= cls.ke_company
        cls.env = cls.env(context=dict(cls.env.context, allowed_company_ids=cls.ke_company.ids))

        cls.work_contact = cls.env['res.partner'].create({
            'name': 'KE Employee',
            'company_id': cls.env.company.id,
        })
        cls.resource_calendar = cls.env['resource.calendar'].create([{
            'name': 'Test Calendar',
            'company_id': cls.env.company.id,
            'hours_per_day': 7.5,
            'tz': "Europe/Brussels",
            'two_weeks_calendar': False,
            'hours_per_week': 45,
            'full_time_required_hours': 45,
            'attendance_ids': [(5, 0, 0)] + [(0, 0, {
                'name': "Attendance",
                'dayofweek': dayofweek,
                'hour_from': hour_from,
                'hour_to': hour_to,
                'day_period': day_period,
                'work_entry_type_id': cls.env.ref('hr_work_entry.work_entry_type_attendance').id

            }) for dayofweek, hour_from, hour_to, day_period in [
                ("0", 8.0, 12.0, "morning"),
                ("0", 13.0, 17.0, "afternoon"),
                ("1", 8.0, 12.0, "morning"),
                ("1", 13.0, 17.0, "afternoon"),
                ("2", 8.0, 12.0, "morning"),
                ("2", 13.0, 17.0, "afternoon"),
                ("3", 8.0, 12.0, "morning"),
                ("3", 13.0, 17.0, "afternoon"),
                ("4", 8.0, 12.0, "morning"),
                ("4", 13.0, 17.0, "afternoon"),
                ("5", 8.0, 13.0, "morning"),
            ]],
        }])

        cls.ke_company.write({
            'resource_calendar_id': cls.resource_calendar.id,
        })

        cls.employee = cls.env['hr.employee'].create({
            'name': 'KE Employee',
            'address_id': cls.work_contact.id,
            'resource_calendar_id': cls.resource_calendar.id,
            'company_id': cls.env.company.id,
            'country_id': cls.env.ref('base.ke').id,
        })

        cls.contract = cls.env['hr.contract'].create({
            'name': "KE Employee's contract",
            'employee_id': cls.employee.id,
            'resource_calendar_id': cls.resource_calendar.id,
            'company_id': cls.env.company.id,
            'structure_type_id': cls.env.ref('l10n_ke_hr_payroll.structure_type_employee_ken').id,
            'date_start': date(2016, 1, 1),
            'wage': 100000.0,
            'state': "open",
            'work_time_rate': 1.0,
        })

    @classmethod
    def _generate_payslip(cls, date_from, date_to, struct_id=False, input_ids=False):
        work_entries = cls.contract.generate_work_entries(date_from, date_to)
        payslip = cls.env['hr.payslip'].create([{
            'name': "Test Payslip",
            'employee_id': cls.employee.id,
            'contract_id': cls.contract.id,
            'company_id': cls.env.company.id,
            'struct_id': struct_id or cls.env.ref('l10n_ke_hr_payroll.hr_payroll_structure_ken_employee_salary').id,
            'date_from': date_from,
            'date_to': date_to,
        }])
        work_entries.action_validate()
        payslip.compute_sheet()
        return payslip

    def _validate_payslip(self, payslip, results):
        error = []
        line_values = payslip._get_line_values(set(results.keys()) | set(payslip.line_ids.mapped('code')))
        for code, value in results.items():
            payslip_line_value = line_values[code][payslip.id]['total']
            if float_compare(payslip_line_value, value, 2):
                error.append("Code: %s - Expected: %s - Reality: %s" % (code, value, payslip_line_value))
        for line in payslip.line_ids:
            if line.code not in results:
                error.append("Missing Line: '%s' - %s," % (line.code, line_values[line.code][payslip.id]['total']))
        if error:
            error.extend([
                "Payslip Actual Values: ",
                "        {",
            ])
            for line in payslip.line_ids:
                error.append("            '%s': %s," % (line.code, line_values[line.code][payslip.id]['total']))
            error.append("        }")
        self.assertEqual(len(error), 0, '\n' + '\n'.join(error))

    def test_payslip_old_paye_computation(self):
        payslip = self._generate_payslip(date(2024, 1, 1), date(2024, 1, 31))
        payslip_results = {'BASIC': 100000.0, 'GROSS': 100000.0, 'NSSF_EMPLOYEE_TIER_1': 360.0, 'NSSF_EMPLOYEE_TIER_2': 720.0, 'GROSS_TAXABLE': 98920.0, 'INCOME_TAX': 24459.35, 'NHIF_AMOUNT_HIDDEN': 1700.0, 'NHIF_RELIEF': -255.0, 'AHL_AMOUNT': 1500.0, 'INSURANCE_RELIEF': -255.0, 'PERS_RELIEF': -2400.0, 'PAYE': 21804.35, 'NSSF_AMOUNT': 1080.0, 'NHIF_AMOUNT': 1700.0, 'STATUTORY_DED': 26084.35, 'TOTAL_DED': 26084.35, 'NITA': 50.0, 'NSSF_EMP': 1080.0, 'AHL_AMOUNT_EMP': 1500.0, 'NET': 73915.65}
        self._validate_payslip(payslip, payslip_results)

    def test_payslip_new_paye_computation(self):
        payslip = self._generate_payslip(date(2025, 1, 1), date(2025, 1, 31))
        payslip_results = {'BASIC': 100000.0, 'GROSS': 100000.0, 'NSSF_EMPLOYEE_TIER_1': 420.0, 'NSSF_EMPLOYEE_TIER_2': 1740.0, 'GROSS_TAXABLE': 93590.0, 'INCOME_TAX': 22860.35, 'AHL_AMOUNT': 1500.0, 'PERS_RELIEF': -2400.0, 'PAYE': 20460.35, 'NSSF_AMOUNT': 2160.0, 'SHIF_AMOUNT': 2750.0, 'STATUTORY_DED': 26870.35, 'TOTAL_DED': 26870.35, 'NITA': 50.0, 'NSSF_EMP': 2160.0, 'AHL_AMOUNT_EMP': 1500.0, 'NET': 73129.65}
        self._validate_payslip(payslip, payslip_results)
