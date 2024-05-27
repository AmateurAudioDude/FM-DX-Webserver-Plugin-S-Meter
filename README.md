# S-Meter plugin for FM-DX-Webserver

* [Download the latest zip file](https://github.com/AmateurAudioDude/FM-DX-Webserver-Plugin-S-Meter/archive/refs/heads/main.zip)
* Transfer `SignalMeterSmall` folder, and `SignalMeterSmall.js` to FM-DX-Webserver `plugins` folder
* Restart FM-DX-Webserver if required
* Login to Adminstrator Panel and enable plugin

## Options

**isOutsideField**: Where the S-Meter is to be displayed, within the SIGNAL field, or below it.

**enableLowSignalInterpolation**: Because approximately -120dBm is the reported noise floor with TEF receivers, the S-Meter will never fall below this level (approx. S4). This attempts to calculate and correct those values based on the signals below -114dBm (just below S6), where true signal deviation from reported signal begins.


v1.1.1
------
* Added option `enableLowSignalInterpolation`
* Signal strength decimal place included in calculations

v1.1
----
* Visual improvements
* Corrected slight signal inaccuracies
* Added lighter grey bar to display signal peak (for current frequency)
* Removed separate image file
* Optional placement within or outside SIGNAL field (edit `pluginSignalMeterSmall.js`)

v1.0
----
* Public release

Original source code located at: https://github.com/NO2CW/FM-DX-Webserver-analog-signal-meter
