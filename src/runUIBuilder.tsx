import { bitable, FieldType } from "@lark-base-open/js-sdk";
// import $ from 'jquery';

declare global {
  interface Window {
    calendar: any;
  }
}

export default async function main(uiBuilder: any) {
  uiBuilder.form((form: any) => ({
    formItems: [
      form.tableSelect('table', { label: '选择数据表和视图' }),
      form.viewSelect('view', { label: '', sourceTable: 'table' }),
      form.select('type', { label: '转换类型', options: [{ label: '公历转农历', value: '公历转农历' }, { label: '农历转公历', value: '农历转公历' }], defaultValue: '公历转农历' }),
      form.fieldSelect('field_source', {
        label: '选择需要转换的日期字段',
        sourceTable: 'table',
        filter: ({ type }: { type: any }) => (type === 5),
      }),
      form.fieldSelect('field_target', {
        label: '选择转换后保存的日期字段',
        sourceTable: 'table',
        filter: ({ type }: { type: any }) => (type === 5),
      }),

    ],
    buttons: ['日期转换'],

  }), async ({ values }: { values: any }) => {
    const { table, view, field_source, field_target, type } = values;
    // console.log(values);

    if (typeof table === 'undefined') { alert("请在多维表格的扩展脚本中运行此插件"); return; };
    if (typeof view === 'undefined') { alert("请选择视图"); return; };
    if (typeof field_source === 'undefined') { alert("请选择需要转换日期的字段"); return; };
    if (typeof field_target === 'undefined') { alert("请选择保存转换后日期的字段"); return; };
    if (field_source === field_target) { alert("不能选择同一个日期字段"); return; };

    uiBuilder.showLoading('正在进行日期转换');

    function formatDate(timestamp: any, type: any, isLeapMonth: boolean) {
      const date = new Date(timestamp);
      const Y = date.getFullYear();
      const M = date.getMonth() + 1 < 10 ? '0' + (date.getMonth() + 1) : date.getMonth() + 1;
      const D = date.getDate();
      let result: any = "";
      let new_date: any = "";
      if (type === '公历转农历') {
        result = window.calendar.solar2lunar(Y, M, D);
        new_date = {
          date_value: result.lYear + "-" + result.lMonth + "-" + result.lDay,
          date_cn: result.IMonthCn + result.IDayCn,
        };
      } else {
        result = window.calendar.lunar2solar(Y, M, D, isLeapMonth);
        new_date = {
          date_value: result.cYear + "-" + result.cMonth + "-" + result.cDay,
          date_cn: result.IMonthCn + result.IDayCn,
        };
      }
      return new_date;
      // return `${Y}-${M}-${D}`;
    }

    try {
      let hasMore = true;
      let pageSize = 500;
      let pageToken = "";
      let update_FieldsList: any = {};
      let update_recordsList: any = [];

      let lcalendar_field: any, lcalendar_field_id: any;
      try {
        lcalendar_field = await table.getFieldByName('农历（中文）');
        lcalendar_field_id = lcalendar_field.id
      } catch (e) {
        lcalendar_field_id = await table.addField({
          type: FieldType.Text,
          name: "农历（中文）",
        });
      }

      while (hasMore) {
        const recordValueList = await table.getRecords({ pageSize: pageSize, pageToken: pageToken, viewId: view.id });
        pageToken = recordValueList.pageToken;
        hasMore = recordValueList.hasMore;
        const get_records = recordValueList.records;
        for (var i = 0; i < get_records.length; i++) {
          let lunar_date_cn: any = "";
          try {
            lunar_date_cn = get_records[i].fields[lcalendar_field_id][0].text;
          } catch (e) {
            lunar_date_cn = "";
          }

          let new_dateValue: any = "";
          let new_timestamp: any = "";
          if (lunar_date_cn.indexOf("闰") >= 0) {
            new_dateValue = formatDate(get_records[i].fields[field_source.id], type, true);
            update_FieldsList[lcalendar_field_id] = lunar_date_cn;
          } else {
            new_dateValue = formatDate(get_records[i].fields[field_source.id], type, false);
            update_FieldsList[lcalendar_field_id] = new_dateValue.date_cn;
          }
          new_timestamp = new Date(new_dateValue.date_value).getTime();
          update_FieldsList[field_target.id] = new_timestamp;

          const value = {
            recordId: get_records[i].recordId,
            fields: update_FieldsList,
          }
          update_recordsList.push(value);
          update_FieldsList = {};
        }
        await table.setRecords(update_recordsList);
        update_recordsList = [];
      }

    } catch (e) {
      alert("转换失败，请刷新后重试");
      uiBuilder.hideLoading();
      return;
    }

    uiBuilder.hideLoading();

  });
}

