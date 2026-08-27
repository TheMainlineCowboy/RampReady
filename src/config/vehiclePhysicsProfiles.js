const MPH_TO_MPS = 0.44704;
const IN_TO_M = 0.0254;
const LB_TO_KG = 0.45359237;
const DEG_TO_RAD = Math.PI / 180;

function steerAngleForRadius(wheelbaseMeters, turningRadiusMeters) {
  return Math.atan(wheelbaseMeters / turningRadiusMeters);
}

const lektro88Wheelbase = 92.1 * IN_TO_M;
const lektro88TurnRadius = 180 * IN_TO_M;
const standupWheelbase = 62.25 * IN_TO_M;
const kubotaWheelbase = 80.5 * IN_TO_M;
const kubotaTurnRadius = 4.0;

export const VEHICLE_PHYSICS_PROFILES = Object.freeze({
  "lektro-88": Object.freeze({
    id: "lektro-88",
    role: "towbarless-pushback",
    referenceModel: "LEKTRO AP8850SDA / LEKTRO 88 class",
    steeringMode: "rear",
    steeringLayout: "rear-pair",
    wheelbase: lektro88Wheelbase,
    trackWidth: 1.72,
    bodyBounds: Object.freeze([2.051, 0.99, 5.288]),
    cradleOffset: 3.45,
    captureAnchor: Object.freeze([0, 0.34, 3.45]),
    liftTravel: 0.23,
    freeMaxSpeed: 9 * MPH_TO_MPS,
    towMaxSpeed: 4 * MPH_TO_MPS,
    freeAcceleration: 1.35,
    towAcceleration: 0.58,
    serviceBrakeDeceleration: 2.7,
    coastDeceleration: 0.42,
    maxSteerAngle: 84 * DEG_TO_RAD,
    kinematicMaxSteerAngle: 80 * DEG_TO_RAD,
    maxSteerRate: 2.20,
    fullLockSpeedScale: 0.10,
    massKg: 9300 * LB_TO_KG,
    collisionRadius: 1.12,
    collisionHeights: Object.freeze([0.42, 0.92, 1.45]),
    operatorEye: Object.freeze([-0.43, 1.28, -1.38]),
    operatorLook: Object.freeze([-0.20, 1.08, 6.8]),
    sourceFacts: Object.freeze({
      emptySpeedMph: 9,
      loadedSpeedMph: 4,
      wheelbaseInches: 92.1,
      turningRadiusInches: 180,
      lengthInches: 208.2,
      widthInches: 80.7,
      steeringWheelHeightInches: 38.9,
      liftInches: 9,
      groundClearanceInches: 5,
      cradleCapacityLb: 12000,
      shipWeightLb: 9300,
      motorHp: 45.3,
      electricalSystemVolts: 72,
      driveTires: "23 x 10 x 12 front drive pair",
      steerTires: "21 x 8-9 rear steer pair on suspended steer axle",
      steering: "hydraulic/electric-hydraulic power steering, dual rear steer wheels",
      powertrain: "electric towbarless cradle/strap tractor",
    }),
  }),

  "standup-tug": Object.freeze({
    id: "standup-tug",
    role: "towbarless-pushback",
    referenceModel: "User-supplied Aircraft_Standup_REVISED_V3",
    steeringMode: "rear",
    steeringLayout: "rear-single",
    wheelbase: standupWheelbase,
    trackWidth: 0.82,
    bodyBounds: Object.freeze([0.978, 1.152, 3.159]),
    cradleOffset: 2.48,
    captureAnchor: Object.freeze([0, 0.34, 2.48]),
    liftTravel: 0.229,
    freeMaxSpeed: 5 * MPH_TO_MPS,
    towMaxSpeed: 3 * MPH_TO_MPS,
    freeAcceleration: 1.25,
    towAcceleration: 0.55,
    serviceBrakeDeceleration: 2.45,
    coastDeceleration: 0.40,
    maxSteerAngle: 86 * DEG_TO_RAD,
    kinematicMaxSteerAngle: 81 * DEG_TO_RAD,
    maxSteerRate: 2.55,
    fullLockSpeedScale: 0.12,
    massKg: 1485 * LB_TO_KG,
    collisionRadius: 0.60,
    collisionHeights: Object.freeze([0.30, 0.78, 1.25]),
    operatorEye: Object.freeze([0.28, 1.62, -0.62]),
    operatorLook: Object.freeze([0.00, 1.57, 4.80]),
    sourceFacts: Object.freeze({
      visualAuthority: "Aircraft_Standup_REVISED_V3.3mf",
      emptySpeedMph: 5,
      loadedSpeedMph: 3,
      wheelbaseInches: 62.25,
      lengthMeters: 3.159,
      widthMeters: 0.978,
      heightMeters: 1.152,
      steering: "single center rear steer wheel, near-90-degree physical articulation",
      operation: "stand-up",
    }),
  }),

  "manager-kubota": Object.freeze({
    id: "manager-kubota",
    role: "airport-inspection",
    referenceModel: "User manager RTV visual; Kubota RTV-X900-class handling reference",
    steeringMode: "front",
    steeringLayout: "front-pair",
    wheelbase: kubotaWheelbase,
    trackWidth: 1.240,
    bodyBounds: Object.freeze([1.605, 2.020, 3.055]),
    cradleOffset: 1.52,
    captureAnchor: Object.freeze([0, 0.34, 1.52]),
    liftTravel: 0,
    freeMaxSpeed: 25 * MPH_TO_MPS,
    towMaxSpeed: 0,
    freeAcceleration: 2.05,
    towAcceleration: 0,
    serviceBrakeDeceleration: 4.0,
    coastDeceleration: 0.62,
    maxSteerAngle: steerAngleForRadius(kubotaWheelbase, kubotaTurnRadius),
    kinematicMaxSteerAngle: steerAngleForRadius(kubotaWheelbase, kubotaTurnRadius),
    maxSteerRate: 0.92,
    fullLockSpeedScale: 0.62,
    massKg: 865,
    collisionRadius: 0.88,
    collisionHeights: Object.freeze([0.42, 1.12, 1.92]),
    operatorEye: Object.freeze([-0.32, 1.50, -0.30]),
    operatorLook: Object.freeze([-0.20, 1.38, 5.2]),
    sourceFacts: Object.freeze({
      maxSpeedMph: 25,
      wheelbaseInches: 80.5,
      turningRadiusMeters: 4.0,
      lengthInches: 120.3,
      widthInches: 63.2,
      heightInches: 79.5,
      massKg: 865,
      steering: "hydrostatic power-assisted front steering",
      brakes: "wet-disc",
      transmission: "VHT-X variable hydrostatic",
    }),
  }),
});

export function getVehiclePhysicsProfile(id) {
  return VEHICLE_PHYSICS_PROFILES[id] || VEHICLE_PHYSICS_PROFILES["lektro-88"];
}
