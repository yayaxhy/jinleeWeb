# Admin Monthly Financial Reports

The monthly report generator writes files to:

```text
storage/admin-revenue-files/
```

By default it generates the previous completed month. On the 1st day of each month at 00:00 Europe/Rome, the scheduler calls:

```text
/api/admin/revenue/files/generate-due
```

The endpoint writes two files for the month:

- `YYYY年M月财务报表.xlsx`
- `YYYY年M月后台收益数据.xlsx`

## Manual Adjustments

Create or edit this server file when a financial statement needs manual rows:

```text
storage/admin-revenue-files/financial-adjustments.json
```

Example:

```json
{
  "default": {
    "capitalAmount": 120000
  },
  "months": {
    "2026-06": {
      "expenseRows": [
        {
          "source": "备注支出",
          "date": "2026-06-30",
          "description": "补记支出",
          "amount": 500,
          "count": 1,
          "note": "手工补录"
        }
      ],
      "incomeRows": [
        {
          "name": "手工收入调整",
          "amount": 100,
          "note": "手工补录"
        }
      ],
      "priorProfitRows": [
        {
          "label": "5月盈利",
          "amount": 36875.98,
          "note": "上月未分红"
        }
      ]
    }
  }
}
```

After editing the JSON, open `/admin/revenue/files`, select the month, tick `覆盖同名文件`, and generate again.

