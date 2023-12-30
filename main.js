const moment = require('moment')
const CalendarModule = require('./Calendar')
const assert = require('assert')

let cd = new CalendarModule.DefaultCalendarData(2);
let p = new CalendarModule.DefaultProcessor(cd);
let c = new CalendarModule.Calendar(p);

const xx= c.getAvailability('13-04-2023', 25);

//console.log(xx);