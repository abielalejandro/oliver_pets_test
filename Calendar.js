const moment = require('moment');
const fs = require('fs');

class Processor {
  #daySlots = {};
  #calendarDataSource;
  constructor(calendarDataSource) {
    if (this.constructor == Processor) {
      throw new Error('Must instantiate the class;');
    }
    this.#calendarDataSource = calendarDataSource;
  }

  getAvailableSpots(calendarDataSource) {
    throw new Error('Must implement available spots method');
  }

  __getMomentHour(dateISO, hour) {
    return moment(dateISO + ' ' + hour);
  }

  __addMinutes(hour, minutes) {
    return moment(hour).add(minutes, 'minutes').format('HH:mm');
  }

  __getOneMiniSlot(
    slotMetaData = {
      startSlot: null,
      endSlot: null,
      duration: null,
      dateISO: null,
    },
  ) {
    const { durationBefore, durationAfter } =
      this.#calendarDataSource.getData();

    const { startSlot, endSlot, duration, dateISO } = slotMetaData;

    const startHourFirst = this.__getMomentHour(dateISO, startSlot);

    const startHour = startHourFirst.format('HH:mm');
    const endHour = this.__addMinutes(
      startHourFirst,
      durationBefore + duration + durationAfter,
    );
    const clientStartHour = this.__addMinutes(startHourFirst, durationBefore);
    const clientEndHour = this.__addMinutes(startHourFirst, duration);

    if (
      moment.utc(endHour, 'HH:mm').valueOf() >
      moment.utc(endSlot, 'HH:mm').valueOf()
    ) {
      return null;
    }
    const objSlot = {
      startHour: moment.utc(dateISO + ' ' + startHour).toDate(),
      endHour: moment.utc(dateISO + ' ' + endHour).toDate(),
      clientStartHour: moment.utc(dateISO + ' ' + clientStartHour).toDate(),
      clientEndHour: moment.utc(dateISO + ' ' + clientEndHour).toDate(),
    };
    return objSlot;
  }

  __getDaySlots(date, duration) {
    if (!date) return [];
    if (date in this.#daySlots) return this.#daySlots[date];
    const data = this.#calendarDataSource.getData();
    this.#daySlots[date] = data.slots[date] || [];
    const dateISO = moment(date, 'DD-MM-YYYY').format('YYYY-MM-DD');

    return this.#daySlots[date].filter((daySlot) => {
      const start = moment(dateISO + ' ' + daySlot.start).valueOf();
      const end = moment(dateISO + ' ' + daySlot.end).valueOf();
      return ( (end-start) >= (duration *60*1000) );
    });
  }

  __getRealSlots(daySlots, dateISO, date) {
    const data = this.#calendarDataSource.getData();

    if (!(data.sessions || data.sessions[date])) return [];

    const sessions = data.sessions[date];

    return daySlots.filter((daySlot)=>{
      const start = moment(dateISO + ' ' + daySlot.start);
      const end = moment(dateISO + ' ' + daySlot.end);
      return !sessions.find((sessionSlot)=>{
        const sessionStart = moment(
          dateISO + ' ' + sessionSlot.start,
        ).valueOf();
        const sessionEnd = moment(dateISO + ' ' + sessionSlot.end);
        return (start.isSameOrBefore(sessionStart) && end.isSameOrAfter(sessionEnd))
        || (start.isSameOrAfter(sessionStart) && start.isSameOrBefore(sessionEnd))
        || (end.isSameOrAfter(sessionStart) && end.isSameOrBefore(sessionEnd))
      });
    });
  }

  __prepareResultSlots(realSpots = [], dateISO, duration) {
    
    return realSpots.map((slot)=>{
      return this.__getOneMiniSlot({
        startSlot: slot.start,
        endSlot: slot.end,
        duration,
        dateISO,
      });
    }).filter(spot=> spot);
  }
  __getSlots(date, duration) {
    const dateISO = moment(date, 'DD-MM-YYYY').format('YYYY-MM-DD');
    const daySlots = this.__getDaySlots(date, duration);
    const realSpots = this.__getRealSlots(daySlots, dateISO, date);
    return this.__prepareResultSlots(realSpots, dateISO, duration);
  }

  getAvailableSpots(date, duration) {
    return this.__getSlots(date, duration);
  }
}

class DefaultProcessor extends Processor {
  constructor(calendarDataSource) {
    super(calendarDataSource);
    if (!calendarDataSource || !(calendarDataSource instanceof CalendarData)) {
      throw new Error('Invalid data source');
    }
  }
}

class CalendarData {
  constructor() {
    if (this.constructor == CalendarData) {
      throw new Error('Must instantiate the class;');
    }
  }

  __build() {
    throw new Error('Must implement build method');
  }

  getData() {
    throw new Error('Must implement the getData method');
  }
}

class DefaultCalendarData extends CalendarData {
  #pathFile;
  #data;
  constructor($pathFile) {
    super();
    this.#pathFile = $pathFile;
    this.__build();
  }

  __build() {
    const rawdata = fs.readFileSync(
      './calendars/calendar.' + this.#pathFile + '.json',
    );
    this.#data = JSON.parse(rawdata);
  }

  getData() {
    return this.#data;
  }
}

class Calendar {
  #processor;
  constructor(processor) {
    this.#processor = processor;
    if (!processor || !(processor instanceof Processor))
      throw new Error('Invalid processor');
  }

  getAvailability(date, duration) {
    return this.#processor.getAvailableSpots(date, duration);
  }
}

module.exports = { Calendar, DefaultCalendarData, DefaultProcessor };
