# S-Meter plugin for FM-DX Webserver

This plugin displays a signal meter below the signal data.

Displayed outside or within the SIGNAL container, your choice.

![outside_true](https://github.com/AmateurAudioDude/FM-DX-Webserver-Plugin-S-Meter/assets/168192910/a0b7d7f6-64e7-4664-b94f-d82b0ba90aa6)   
![outside_false](https://github.com/AmateurAudioDude/FM-DX-Webserver-Plugin-S-Meter/assets/168192910/c4085abe-847c-415d-ba09-330563b080a7)

* [Download the latest zip file](https://github.com/AmateurAudioDude/FM-DX-Webserver-Plugin-S-Meter/archive/refs/heads/main.zip)
* Transfer `SignalMeterSmall` folder, and `SignalMeterSmall.js` to FM-DX-Webserver `plugins` folder
* Restart FM-DX Webserver if required
* Login to Adminstrator Panel and enable plugin

## Options

#### Open `pluginSignalMeterSmall.js` with a text editor to find available options at the beginning of the file.

`OUTSIDE_FIELD`: Where the S-Meter is to be displayed, within the SIGNAL panel, or below it.

`ENABLE_SQUELCH`: Adjustable squelch marker that mutes all signals below the set threshold. Squelch setting does not affect other listeners.

`USE_THEME_COLORS`: Background uses the webpage's theme instead of the default grey style.

`RADIO_NOISE_FLOOR`: Because approximately -123dBm is the reported noise floor with TEF receivers (reported dBm signal reading with no antenna connected), the S-Meter will never fall below this level (approx. S4). This attempts to calculate and correct those values based on the signals below -114dBm (just below S6), where true signal deviation from reported signal begins. This is used to calibrate low signal interpolation. A setting of 0 disables this setting.

`METER_LOCATION`: Set to 'auto' for default meter position, or force with 'signal', 'sdr-graph', 'sdr-graph-only', 'peakmeter', or 'auto-rotator'.


v1.3.8
------
* Added AM offset option for more accurate readings on the HF band.

v1.3.7
------
* Removed unneeded code
* Minor fixes

v1.3.6
------
* Numbers and scale markers manually drawn (to match PeakMeter plugin design)
* Minor fixes

v1.3.5
------
* Fix for FM-DX Webserver v1.3.5 compatibility issues

v1.3.4
------
* Added intergration with Spectrum Graph plugin

v1.3.3
------
* Fix for squelch volume

v1.3.2
------
* Fix compatibility issue with latest PEAKMETER plugin

v1.3.1
------
* Added support for PEAKMETER plugin element

v1.3.0
------
* Slight frames per second increase
* Minor blur effect to match recent FM-DX Webserver version
* Background colour and squelch needle match theme
* White canvas text inverted for dark text themes with bright backgrounds
* Squelch volume internal setting
* Strict "S0-S9+60" meter range internal setting
* Small squelch needle display internal setting
* Minor bug fixes

v1.2.2
------
* Added squelch touch and drag ability for touchscreen devices

v1.2.1
------
* Fix for FM-DX Webserver v1.2.4 compatibility issues

v1.2.0
------
* Added client-side squelch

v1.1.5
------
* Improved alignment based on window dimensions

v1.1.4
------
* Fix for some cases of canvas being cropped

v1.1.3
------
* Corrected decimal place calculations for all signal units

v1.1.2
------
* Aligned signal meter appearance and positioning

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
