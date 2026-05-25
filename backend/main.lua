local logger = require("logger")
local millennium = require("millennium")

local function on_load()
    logger:info("[steam-rating] loading v1.0.14")
    millennium.ready()
end

local function on_frontend_loaded()
    logger:info("[steam-rating] frontend loaded")
end

local function on_unload()
    logger:info("[steam-rating] unloaded")
end

return {
    on_frontend_loaded = on_frontend_loaded,
    on_load = on_load,
    on_unload = on_unload
}
