// Opcodes
export const OPCODES = {
  GET_DEVICE_INFO: 0x1001,
  OPEN_SESSION: 0x1002,
  CLOSE_SESSION: 0x1003,
  SDIO_CONNECT: 0x9201,
  SDIO_GET_EXT_DEVICE_INFO: 0x9202,
  SDIO_SET_EXT_DEVICE_PROP_VALUE: 0x9205,
  SDIO_CONTROL_DEVICE: 0x9207,
  SDIO_GET_ALL_EXT_DEVICE_PROP_INFO: 0x9209,
} as const;

// Property Codes — core (confirmed, used in control path)
export const PROP_CODES = {
  // Standard PTP
  WHITE_BALANCE: 0x5005,
  FNUMBER: 0x5007,
  FOCUS_MODE: 0x500A,
  EXPOSURE_MODE: 0x500E,
  EXP_COMP: 0x5010,

  // Sony vendor — exposure
  FLASH_COMP: 0xD200,
  SHUTTER_SPEED: 0xD20D,
  COLOR_TEMP: 0xD20F,
  WB_GM: 0xD210,
  WB_AB: 0xD21C,
  ISO: 0xD21E,

  // Sony vendor — cinema Auto/Manual mode toggles (UINT8: 0x01 Auto / 0x02 Manual)
  // Confirmed against Camera Control PTP 3 Reference. Present only on cinema bodies.
  IRIS_MODE: 0xD001,
  SHUTTER_MODE: 0xD013,
  GAIN_CONTROL: 0xD01C,
  EXPOSURE_CTRL_TYPE: 0xD099,

  // Sony vendor — battery / power
  BATTERY_ICON: 0xD205,
  BATTERY_LEVEL: 0xD20E,
  BATTERY_REMAIN: 0xD218,
  POWER_SOURCE: 0xD03A,        // 0x01=DC, 0x02=Battery, 0x03=PoE
  BATTERY_REMAIN_MIN: 0xD038,  // remaining minutes (UINT32)
  USB_POWER_SUPPLY: 0xD150,    // 0x01=Off, 0x02=On, 0x03=Auto

  // Sony vendor — recording
  REC_STATE: 0xD21D,
  MOVIE_REC_BUTTON: 0xD2C8,

  // Sony vendor — focus
  FOCUS_AREA: 0xD22C,
  AF_STATUS: 0xD213,
  NEAR_FAR: 0xD2D1,
  FOCUS_STEP_NEAR: 0xD2D7,
  FOCUS_STEP_FAR: 0xD2D8,
  FOCUS_MAGNIFIER: 0xD2CB,
  FOCUS_MAGNIFIER_CANCEL: 0xD2CC,

  // Sony vendor — buttons
  S1_BUTTON: 0xD2C1,
  S2_BUTTON: 0xD2C2,
  AEL_BUTTON: 0xD2C3,
  AFL_BUTTON: 0xD2C4,
} as const;

// Property Codes — extended PTP3 research set
// These are known but may not be present on all cameras.
// Only read/write after confirming the camera exposes the property via runtime model.
export const PROP_CODES_EXT = {
  // --- Display / Touch ---
  REC_SETTINGS_RESET_ENABLE:    0xD043,
  MONITOR_DISP_MODE_CANDIDATES: 0xD044,
  MONITOR_DISP_MODE_SETTING:    0xD045,
  MONITOR_DISP_MODE:            0xD046,
  TOUCH_OPERATION:              0xD047,
  AUTO_POWER_OFF_TEMP:          0xD049,
  BODY_KEY_LOCK:                0xD04A,
  IMAGE_ID:                     0xD04B,
  MONITOR_LUT_SETTING:          0xD04D,

  // --- S&Q / Interval ---
  SQ_FRAME_RATE:                0xD052,
  INTERVAL_REC_TIME:            0xD055,
  UPLOAD_DATASET_VERSION:       0xD057,
  BASELOOK_IMPORT_CMD_VERSION:  0xD059,

  // --- Subject Recognition / AF ---
  SUBJECT_RECOGNITION_AF:       0xD060,
  AF_TRANSITION_SPEED:          0xD061,
  AF_SUBJECT_SHIFT_SENS:        0xD062,

  // --- HDMI ---
  HDMI_OSD:                     0xD079,

  // --- BaseLook / LUT ---
  BASELOOK_IMPORT_ENABLE:       0xD08B,
  IMAGE_ID_SETTING:             0xD092,
  FTP_SETTING_ENABLE:           0xD09A,
  FOCUS_BRACKET_STATUS:         0xD0AB,
  CAMERA_OPERATING_MODE:        0xD0BC,
  FW_UPDATE_CMD_VERSION:        0xD0BF,
  FIRMWARE_UPDATE_STATUS:       0xD0C0,
  TYPE_C_ACCESSORY_MODE:        0xD0C5,
  PIXEL_MAPPING_ENABLE:         0xD0C6,
  DELETE_USER_BASELOOK:         0xD0C7,
  SELECT_USER_BASELOOK_EDIT:    0xD0C8,
  USER_BASELOOK_INPUT:          0xD0C9,
  USER_BASELOOK_AE_OFFSET:      0xD0CA,
  SELECT_BASELOOK_FOR_PPLUT:    0xD0CC,
  SQ_REC_FRAME_RATE:            0xD0D0,
  USER_BIT_PRESET:              0xD0D4,
  USER_BIT_TIME_REC:            0xD0D8,
  STABILIZATION_MOVIE:          0xD0DA,
  SILENT_MODE:                  0xD0DB,
  SILENT_MODE_APERTURE_DRIVE:   0xD0DC,

  // --- Picture Profile ---
  PP_BLACK_LEVEL:               0xD0E0,
  PP_GAMMA:                     0xD0E1,
  PP_BLACK_GAMMA_RANGE:         0xD0E2,
  PP_BLACK_GAMMA_LEVEL:         0xD0E3,
  PP_KNEE_MODE:                 0xD0E4,
  PP_KNEE_AUTO_SENSITIVITY:     0xD0E6,
  PP_KNEE_MANUAL_SLOPE:         0xD0E8,
  PP_COLOR_MODE:                0xD0E9,
  PP_SATURATION:                0xD0EA,
  PP_COLOR_PHASE:               0xD0EB,
  PP_COPY:                      0xD0F9,

  // --- Creative Look ---
  CREATIVE_LOOK:                0xD0FA,
  PP_RESET_ENABLE:              0xD107,
  CREATIVE_LOOK_RESET_ENABLE:   0xD108,

  // --- Second battery ---
  SECOND_BATTERY_REMAIN:        0xD12D,
  SECOND_BATTERY_LEVEL:         0xD12E,

  // --- WB custom capture ---
  CUSTOM_WB_SIZE:               0xD135,

  // --- ISO Auto ---
  ISO_AUTO_MIN_SHUTTER_MODE:    0xD14D,
  USB_POWER_SUPPLY:             0xD150,
  INTERVAL_REC_FPS:             0xD151,

  // --- Subject Recognition detailed ---
  SUBJECT_RECOGNITION_IN_AF:   0xD157,
  RECOGNITION_TARGET:          0xD158,
  EYE_SELECT:                  0xD159,
  HIGH_ISO_NR:                 0xD15C,
  HLG_STILL_IMAGE:             0xD15D,
  COLOR_SPACE_STILL:           0xD15E,

  // --- Bracketing ---
  BRACKET_ORDER:               0xD166,
  FOCUS_BRACKET_ORDER:         0xD167,
  FOCUS_BRACKET_AEL:           0xD168,

  // --- Auto slow shutter / Soft skin / etc ---
  WIND_NOISE_REDUCTION:        0xD171,
  AUTO_SLOW_SHUTTER:           0xD173,
  ISO_AUTO_MIN_SHUTTER_MANUAL: 0xD176,
  ISO_AUTO_MIN_SHUTTER_PRESET: 0xD177,
  SOFT_SKIN_EFFECT:            0xD178,
  PRIORITY_AF_S:               0xD179,
  PRIORITY_AF_C:               0xD17A,
  FOCUS_MAG_TIME:              0xD17B,
  PLAYBACK_VOLUME:             0xD17C,
  AUTO_REVIEW:                 0xD17D,
  AUDIO_SIGNALS:               0xD17E,

  // --- HDMI extended ---
  HDMI_REC_MEDIA_MOVIE:        0xD180,
  HDMI_4K_MOVIE:               0xD182,
  HDMI_TIMECODE_MOVIE:         0xD186,
  HDMI_REC_CONTROL_MOVIE:      0xD187,

  // --- Stabilization ---
  STABILIZATION_ADJ:           0xD192,
  STABILIZATION_FOCAL_LENGTH:  0xD193,
  CAMERA_SHAKE_STATUS:         0xD194,
  UPDATE_BODY_STATUS:          0xD195,
  EMBED_LUT_FILE:              0xD196,
  MEDIA_SLOT1_WRITING:         0xD197,

  // --- Focus distance / position ---
  FOCAL_DISTANCE_METER:        0xD004,  // raw / 100 = meters (e.g. 20 → 0.20m)
  FOCAL_DISTANCE_FEET:         0xD005,  // raw / 100 = feet
  FOCUS_BRACKET_SHOT_NUM:      0xD2A1,
  AF_AREA_POSITION:            0xD2DC,  // (x, y) touch focus position
  FOCUS_POSITION_SETTING:      0xE042,  // absolute position 0x0000=near 0xFFFF=far (PTP3)
  FOCUS_POSITION_CURRENT:      0xE043,  // current lens position readback (PTP3)

  // --- Focus enable / drive status ---
  NEAR_FAR_ENABLE:             0xD235,  // 0x01=enabled, 0x00=disabled — check before step commands
  FOCUS_INT16_ENABLE:          0xE045,  // 0x01=enabled — required for 0xF004 continuous drive

  // --- Focus absolute ---
  FOCUS_DRIVING_STATUS:        0xD19C,
  ZOOM_DRIVING_STATUS:         0xD19D,
  AF_FREE_SIZE_POSITION_DEFAULT: 0xD19E,
  EXTENDED_SHUTTER_SPEED:      0xD19F,

  // --- Lens compensation ---
  LENS_COMP_SHADING:           0xD1A2,
  LENS_COMP_CHROMATIC:         0xD1A3,
  LENS_COMP_DISTORTION:        0xD1A4,
  LENS_COMP_BREATHING:         0xD1A5,
  FOCUS_BRACKET_FOLDER:        0xD1A6,
  RELEASE_WITHOUT_LENS:        0xD1A7,
  RELEASE_WITHOUT_CARD:        0xD1A8,
  PRIORITY_AWB:                0xD1AA,
  APERTURE_DRIVE_IN_AF:        0xD1AC,
  AF_WITH_SHUTTER:             0xD1AD,
  PRE_AF:                      0xD1AF,
  DISPLAY_QUALITY:             0xD1B0,
  AUDIO_SIGNALS_VOLUME:        0xD1B1,
  HDMI_CEC:                   0xD1B2,
  SELF_TIMER_STATUS:           0xD1B4,
  ISO_AUTO_RANGE_MIN:          0xD1B6,
  ISO_AUTO_RANGE_MAX:          0xD1B7,
  FACE_EYE_FRAME_DISPLAY:      0xD1B8,
  AF_IN_FOCUS_MAGNIFIER:       0xD1BA,
  PROGRAM_SHIFT_STATUS:        0xD1BF,
  TRACKING_AF_ON_ENABLE:       0xD1C6,
  RECORDING_FILE_NUMBER:       0xD1C8,
  FORCED_FILE_NUM_RESET_ENABLE: 0xD1C9,
  RECORDING_FOLDER_FORMAT:     0xD1CB,
  WRITE_COPYRIGHT_INFO:        0xD1CD,
  CREATE_NEW_FOLDER_ENABLE:    0xD1DB,
  MIC_DIRECTIVITY:             0xD1DD,
  GRID_LINE_DISPLAY:           0xD1DE,
  AMOUNT_OF_DEFOCUS:           0xD1E0,
  CINEMATIC_VLOG_SETTING:      0xD1E1,
  CINEMATIC_VLOG_MOOD:         0xD1E3,
  CINEMATIC_VLOG_AF_SPEED:     0xD1E4,
  FACE_PRIORITY_METERING:      0xD1E5,

  // --- Subject Rec advanced ---
  SUBJ_REC_PERSON_TRACKING_RANGE: 0xD1E6,
  SUBJ_REC_ANIMAL_BIRD_PRIORITY:  0xD1E7,
  SUBJ_REC_ANIMAL_BIRD_PARTS:     0xD1E8,

  // --- Monitor Brightness ---
  MONITOR_BRIGHTNESS_TYPE:     0xD1FB,
  TC_UB_DISPLAY:               0xD1FD,
  GAMMA_DISPLAY_ASSIST:        0xD1FE,
  GAMMA_DISPLAY_ASSIST_TYPE:   0xD1FF,

  // --- OSD / Button capabilities ---
  OSD_IMAGE_MODE:              0xD207,
  CAMERA_BUTTON_CAPABILITY:    0xD208,

  // --- Audio ---
  AUDIO_SIGNALS_START_END:     0xD220,

  // --- Still image ---
  STILL_IMAGE_QUALITY:         0xD252,
  FILE_FORMAT_STILL:           0xD253,
  FOCUS_MAGNIFIER_SETTING:     0xD254,
  AF_TRACKING_SENSITIVITY:     0xD255,
  ZOOM_SCALE:                  0xD25C,
  ZOOM_BAR_INFO:               0xD25D,
  ZOOM_SPEED_RANGE:            0xD25E,
  ZOOM_SETTING:                0xD25F,
  ZOOM_TYPE_STATUS:            0xD260,
  RED_EYE_REDUCTION:           0xD263,
  STILL_IMAGE_TRANS_SIZE:      0xD268,
  LIVE_VIEW_IMAGE_QUALITY:     0xD26A,
  CUSTOM_WB_EXEC_STATE:        0xD270,

  // --- Camera settings save/load ---
  MEDIA_SLOT1_FORMAT_ENABLE:   0xD279,
  FORMAT_PROGRESS:             0xD27B,
  SELECT_FTP_SERVER:           0xD27C,
  FUNCTION_OF_TOUCH:           0xD283,
  REMOTE_TOUCH_ENABLE:         0xD284,
  RAW_FILE_TYPE:               0xD288,
  SLOT1_QUICK_FORMAT_ENABLE:   0xD292,
  SAVE_ZOOM_FOCUS_POSITION:    0xD297,
  LOAD_ZOOM_FOCUS_POSITION:    0xD298,
  REMOTE_CONTROL_ZOOM_SPEED:   0xD299,
  APSC_FULL_SWITCH_ENABLE:     0xD29B,
  MOVIE_REC_SELF_TIMER:        0xD29C,
  FOCUS_BRACKET_RANGE:         0xD2A2,
  AF_TRACK_SPEED_CHANGE:       0xD2AD,
  FLICKER_SCAN_STATUS:         0xD2BA,
  FLICKER_SCAN_ENABLE:         0xD2BB,

  // --- Streaming ---
  STREAM_STATUS:               0xD119,
  STREAM_SETTING:              0xD450,
  STREAM_RESOLUTION:           0xD451,
  STREAM_FRAMERATE:            0xD452,
  STREAM_STATE:                0xD456,

  // --- Tally (PTP3 v1.3+) ---
  TALLY_RED:                   0xD513,
  TALLY_GREEN:                 0xD514,
  TALLY_YELLOW:                0xD515,

  // --- E-series movie ---
  MOVIE_SHOOTING_MODE:         0xE000,
  MOVIE_COLOR_GAMUT:           0xE001,
  FOCUS_TOUCH_SPOT_STATUS:     0xE004,
  FOCUS_TRACKING_STATUS:       0xE005,
  RECORDER_PROXY_SETTING:      0xE00D,
  AF_ASSIST:                   0xE084,
  LENS_INFO_ENABLE:            0xE086,
  ENLARGE_SCREEN_SETTING:      0xE0CD,
} as const;

// SDIControlType
export const SDI_CONTROL_TYPE = {
  BUTTON: 0x81,
  NOTCH: 0x82,
  LOCK: 0x83,
} as const;

// Button values
export const BUTTON = {
  UP: 0x0001,
  DOWN: 0x0002,
} as const;

// SDI Extension Version
export const SDI_EXTENSION_VERSION = 0xC8;

// Focus mode values (prop 0x500A) — confirmed against Camera Control PTP 3 Reference.
export const FOCUS_MODE_VALUES = {
  MANUAL: 0x0001,  // MF
  AF_S:   0x0002,  // AF-S (single-shot)
  AF_C:   0x8004,  // AF-C (continuous)
  AF_A:   0x8005,  // AF-A (automatic switch S/C)
  DMF:    0x8006,  // DMF (direct manual focus after AF)
  AF_D:   0x8008,  // AF-D (hybrid, PTP3 ref)
  PF:     0x8009,  // Preset Focus
} as const;

// Focus area values (prop 0xD22C) — confirmed against Camera Control PTP 3 Reference.
export const FOCUS_AREA_VALUES = {
  WIDE:         0x0001,
  ZONE:         0x0002,
  CENTER:       0x0003,
  FLEXIBLE_S:   0x0101,
  FLEXIBLE_M:   0x0102,
  FLEXIBLE_L:   0x0103,
  FLEXIBLE_XS:  0x0106,  // PTP3 ref (was wrongly 0x0104 = Expand Flexible Spot)
  FLEXIBLE_XL:  0x0107,  // PTP3 ref (was wrongly 0x0105 = Flexible Spot generic)
  LOCK_ON_AF:   0x0201,  // Lock on AF Wide (was wrongly 0x0202 = Lock on AF Zone)
} as const;

// AF status values (prop 0xD213 — Focus Indication)
export const AF_STATUS_VALUES = {
  FOCUSED:     0x02,  // focus locked
  NOT_FOCUSED: 0x03,  // searching / not in focus
  TRACKING:    0x05,  // subject tracking active
} as const;

// Kelvin scale fallback for cameras that don't enumerate ColorTemp (e.g. FX30)
export const KELVIN_SCALE: number[] = [
  2500, 2600, 2700, 2800, 2900, 3000, 3200, 3400, 3600, 3800,
  4000, 4200, 4500, 4800, 5000, 5200, 5500, 5600, 6000, 6500,
  7000, 7500, 8000, 9000, 9900,
];
