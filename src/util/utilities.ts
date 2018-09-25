import { Day } from "./classes";
import { Request, Response, NextFunction } from "express";
import { BookingFPModel } from "../models/BookFP";
import { ConfigModel } from "../models/Config";
import { BookingStatus, RespItem } from "./classes";
import { default as Db } from "../util/db";
import { resolve } from "dns";

const Utilities = (function () {
  const weekday = new Array("Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat");

  const GetSimpleDateFromToday = function (addDays: number): Day {
    const today = new Date(new Date().getTime() + addDays * 24 * 60 * 60 * 1000); // Tue Sep 25 2018 22:23:40 GMT+0030 (Eastern...)
    const dn = weekday[today.getDay()];
    const dd = today.getDate(); // 25
    const mm = today.getMonth() + 1; // 9 - January is 0!
    const yyyy = today.getFullYear(); // 2018
    const justDate = new Date(yyyy, mm - 1, dd);
    const prettyToday = `${dn} ${dd}/${mm}/${yyyy}`;
    const day = new Day();
    day.internalDate = justDate; // 26/9/2018
    day.userDate = prettyToday; // Thu 26/9/2018
    return day;
  };

  const ProcessFPDayByDay = function(req: Request, config: ConfigModel, bookingsStartingToday: BookingFPModel[]): Promise<RespItem[]> {
    return new Promise<RespItem[]> ((resolve, reject) => {
      const response: RespItem[] = [];
      const nextWeek: Day[] = [];
      for (let i = 0; i <= 6; i++) {
        const day = Utilities.GetSimpleDateFromToday(i);
        nextWeek.push(day);
      }

      nextWeek.forEach(day => {
        let daystatus: BookingStatus = BookingStatus.Available;
        let usersExploded: string = "";
        bookingsStartingToday.forEach(booking => {
          if (day.internalDate.getTime() === booking.bookDate.getTime()) {
            if (booking.users.length >= config.parkingSpotsNoFP) {
              daystatus = BookingStatus.Full;
            }
            if (-1 !== booking.users.indexOf(req.user.emailId)) {
              daystatus = BookingStatus.Booked;
            }
            booking.users.forEach(userMail => {
              usersExploded += userMail + "\n";
            });
          }
        });
        const item: RespItem = {
          userDate: day.userDate,
          internalDate: day.internalDate,
          status: daystatus,
          usersExploded: usersExploded
        };
        response.push(item);
      });
      resolve(response);
    });
  };

  const CreateFPResponse = function (req: Request, bookingsStartingToday: BookingFPModel[]): Promise<RespItem[]> {
    return new Promise<RespItem[]> ((resolve, reject) => {
      Db.GetConfig().then(config => {
        return Utilities.ProcessFPDayByDay(req, config, bookingsStartingToday);
      }).then(response => {
        resolve(response);
      });
    });
  };

  const IsCurrentUserInFPBookingArray = function (emailId: string, existingFPBook: BookingFPModel): boolean {
    let userFound: boolean = false;
    existingFPBook.users.forEach(mail => {
      if (mail === emailId) {
        userFound = true;
      }
    });
    return userFound;
  };

  const ProcessFPRequest = async function (req: Request, res: Response, next: NextFunction, existingFPBook: BookingFPModel): Promise<void> {
    const config = await Db.GetConfig();
    {
      if (!existingFPBook) {
        Db.SaveBookFPDate(req.body.bookDate, req.user.emailId);
      }
      else {
        const userFound = Utilities.IsCurrentUserInFPBookingArray(req.user.emailId, existingFPBook);
        if (userFound) {
          const updatedUsersArray = existingFPBook.users.filter(user => { return user !== req.user.emailId; });
          Db.UpdateBookFP(req.body.bookDate, updatedUsersArray);
        }
        else {
          if (existingFPBook.users.length <= config.parkingSpotsNoFP - 1) {
            existingFPBook.users.push(req.user.emailId);
            Db.UpdateBookFP(req.body.bookDate, existingFPBook.users);
          }
          else {
            return next("Booking list already full for selected day");
          }
        }
      }
      return res.redirect("/bookfp");
    }
  };

  return {
    GetSimpleDateFromToday: GetSimpleDateFromToday,
    CreateFPResponse: CreateFPResponse,
    IsCurrentUserInFPBookingArray: IsCurrentUserInFPBookingArray,
    ProcessFPRequest: ProcessFPRequest,
    ProcessFPDayByDay: ProcessFPDayByDay
  };
})();
export default Utilities;