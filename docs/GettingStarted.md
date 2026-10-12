# Getting Started

Before you install Deflector Control, setup your hardware and then test DMX control using OLA.

## Hardware

I recommend running this software + OLA on a Raspberry Pi, but you can use any Mac or Linux machine, or a PC with Linux running in a virtual machine.

This guide assumes you are using a Raspberry Pi.

### Materials List - CONTROLLER

Raspberry Pi - Most versions will do. I picked a Raspberry Pi Zero W (W means it has WIFI) which was $29.40CAD

SD memory card - For the Raspberry Pi - I purchased a 32GB card.

SD card reader - to image the card from your computer

USB power supply - compatible with your selected Raspberry Pi

Micro USB/Male to USB A/Female cable - required for Raspberry Pi Zero which does not have USB-A on the board

DSD TECH SH-RS09B USB to DMX - This was $23.99CAD from Amazon.ca. Other USB to DMX products will likely work, but this one is cheap and worked for me.
https://www.amazon.ca/dp/B07WV6P5W6

The above USB to DMX adapter has a female 3-pin XLR connector. If your DMX equipment has 5 pins, you'll need a 3-pin male to 5-pin female adapter. I bought this one (2 for $18.99CAD):
https://www.amazon.ca/dp/B07V7TQ42Q
But I later found singles available for $5.88CAD from MOSS:
https://www.mossled.com/products/xlr-adapter-cable-5-pin-to-3-pin?variant=14141875140

### Tools/Equipment

Multimeter - essential for measuring voltage before connecting LEDs. A cheap one is probably fine. Amazon sells models for $20CAD or even less.

Wire cutter/stripper

Screwdrivers



### Materials List - DECODER/DIMMER/POWER

Transformer - 12V or 24V, depending on the LEDs. The voltage will be printed directly on the LED strip. 12V tends to be used when production needed to be able to cut to more precise lengths, since 12V LED strips can typically be cut every 3 emitters (around 2-3 inches), whereas 24V can only be cut every 6 emitters. Otherwise, 24V is preferred due to lower current (thinner wires can be used), and voltage drop is less of an issue.

It is critical to never connect a 24V power supply to a 12V LED. It will immediately destroy the LED.

You need to make sure your power supply outputs enough amps to power all of the LEDs you will connect to it, plus the decoder/dimmer.

Watts = Amps x Volts

For example, if you have 3 meters of 12-volt RGBW LED strip, and the specification lists 2 amps per meter, you need a power supply that delivers more than 6 amps (or 72 watts) at 12 volts.

Decoder/Dimmer

Star Trek production used MOSS decoders like CINQUE (5 channel) and VENTI-QUATTRO (24 channel) constant voltage decoders. Production also used some CINQUE *constant current* decoders. These are for particular types of LEDs like filament LEDs. Constant current decoders cannot be used with 12V/24V LED strips.

You can attach more than one decoder/dimmer to a single transformer (assuming it provides sufficient current), but you cannot connect more than one transformer to a decoder/dimmer.

Star Trek production appears to have wired an 8-amp circuit breaker on the input to each CINQUE 5 channel decoder/dimmer whenever a power supply with output greater than 8 amps was used (normally connected to more than one decoder/dimmer). You should do this as well. Make sure your wires are sized for the maximum current that could possibly travel over them. 8AMPS -> 18AWG copper is generally sufficient for short runs.

PLEASE NOTE THAT I AM NOT AN ELECTRICIAN AND NOTHING HERE HAS BEEN VERIFIED BY ANY ELECTRICIAN. IT IS YOUR RESPONSIBILTY TO SAFELY INSTALL YOUR EQUIPMENT ACCORDING TO BEST PRACTICES AND LOCAL RECULATIONS.

DMX universes support up to 512 channels. Configure a starting channel for each decoder. For example if you have 2 CINQUE decoder/dimmers, set the starting channel to 1 and 6.

On MOSS decoders, the channel appears on the screen after the letter "A". The A flashes when there is no communication from a controller, and turns solid once a controller starts communicating.

### Materials List - WIRING

For versatility, choose 18/6 (18 AWG, 6 conductors) copper (or tinned copper) wire. 

18 AWG because it safely carries up to 8 amps for short distances.

6 conductors because it carries 5 channels plus common (same capacity as one MOSS CINQUE decoder/dimmer)

Copper (or tinned copper) because cheap alternatives like copper clad aluminum (sold on Amazon, AliExpress, etc.) have significantly lower current carrying capacity so you would need to recalculate your minimum wire guage.

MOSS sells reasonably priced flat cable by the meter
https://www.mossled.com/collections/bulk-cabling-connectors/products/flat-cable?variant=21337666158651

They also sell round cable (with a jacket) but availability seems to be an issue.

You are likely to use at least twice as much cable as you think.

Connectors

My auction purchases had a number of 5 and 6 position pluggable terminal block connectors, but almost all of the were female, so I removed them. I scrounged enough 6-pin pairs so that I could use them to connect my fixtures to the decoders. For all of the wiring on the fixture itself, I used WAGO 221's.

WAGO 221's are super easy to use and re-use so their great for quickly getting in business. I might switch to a more permanent solution later.
I bought this set of 50 and I've used almost every single one for my Star Trek fixtures.
https://www.amazon.ca/dp/B0BLY144T3

Pluggable terminal block connectors can be purchased from MOSS, but these are only good for 1:1 connections. If you need to tie in more than 2 wires, you need a WAGO 221 or perhaps just solder and heat shrink tubing, or another solution. I'm unsure what the film production was doing to tie things together. For example a tech box has 4 separate LED strips for each of the 4 sides of the box. Each was an RGBW strip, so it would need 4 channels. Presumably they tied in the 4 together so they'd only need 4 channels, otherwise they would have needed 16 channels.




## Setting up the Pi and testing DMX control

Download Raspberry Pi Imager to your computer.

I installed Raspberry Pi OS Lite (32-bit) on a 32GB Micro SD Card (choose an appropriate version for your Pi). The Lite OS may improve performance but does not have a GUI and I believe you don't get any output on HDMI.

The Pi Imager allows you to set the username, hostname, password, and WIFI settings. I chose the following options and these instructions assume you set the username and hostname the same:

Username pi
Hostname pizero
Password [memorable password]
SSH Enabled (password)
WIFI - input your WIFI info

After imaging, insert the SD card into the Pi, plugin the DMX cable, and power.

After a minute or two, you should be able to connect over SSH.

Open a Terminal and type `ssh pi@pizero.local`

Input the password when prompted

Update your OS with `sudo apt update` and `sudo apt upgrade`



I also configured my Pi to bring up its own hotspot if it is unable to connect to the specified WIFI. That way I have a way to connect to it so I can change the WIFI configuration if it changes, or if I want to connect to it when it's out of range of its configured WIFI router. Ask your favourite AI for help with this if you want to do the same.



Verify that the USB DMX adapter is seen with `ls /dev/ttyUSB*`

Install OLA:

```
sudo apt install ola
sudo systemctl enable olad
sudo systemctl status olad
```

If you are using the DSD Tech SH-RS09B adapter like me (a FT232R-based adapter), you will be using the "FTDI USB DMX" plugin. This plugin is not enabled by default. I ran into an issue where this plugin would not work unless "Serial USB" and "Enttec Open DMX" plugins were disabled.

Follow the following steps (nano commands open a text editor, make the specified edit, then save with CTRL-O, then exit with CTRL-X)

sudo nano /etc/ola/ola-ftdidmx.conf
Set enabled = true
sudo nano /etc/ola/ola-usbserial.conf
Set enabled = false
sudo nano /etc/ola/ola-opendmx.conf
Set enabled = false
sudo systemctl restart olad
ola_dev_info
Should see something like:
Device 8: FT232R USB UART with serial number : BG03M488 
  port 1, OUT FT232R USB UART with serial number : BG03M488

Open a web browser and open the OLA interface at http://pizero.local:9090

Configure OLA using the web UI

Click Add Universe
Provide an ID (1) and name (eg: MyUniverse), select the above interface and add.
Go to DMX Console tab. Test DMX control. Use a multimeter (connect the positive termal to COM+ and the negative terminal to the desired channel) to confirm that voltage changes from zero (or near zero) to 12V or 24V when you set the channel to anything other than zero.

Here's a sample command you can run to test the web API:

`curl http://localhost:9090/set_dmx -d u=1 -d d=0,255,0,0,0,0,0,0,0`

This should set channel 2 to 255, and channel 1 and 3-9 to 0 (modify as needed)

Congratulations on getting this far!

Now you can begin installing the control software.

While still connected to SSH, install NodeJS:

`sudo apt install nodejs npm`

