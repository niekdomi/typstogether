import { styleText } from "node:util";

import { pino } from "pino";
import PinoPretty from "pino-pretty";

import { logLevel } from "./env";

// Format follows the environment: JSON in production, pretty everywhere else (dev, tests).
const isProduction = process.env.NODE_ENV === "production";

const options = { level: logLevel };

const root = isProduction
  ? pino(options)
  : pino(
    options,
    PinoPretty({
      colorize: true,
      useOnlyCustomProps: false,
      customColors: "message:white",
      singleLine: true,
      translateTime: "SYS:yyyy-mm-dd HH:MM:ss.l",
      ignore: "pid,hostname,module",
      messageFormat: "{if module}[{module}] {end}{msg}",
      customPrettifiers: {
        time: (ts) => styleText("gray", typeof ts === "string" ? ts : JSON.stringify(ts)),
      },
    })
  );

// Every log carries a `module` binding: "app" by default.
export const log = root.child({ module: "app" });

export type Logger = typeof log;
