public class AssignmentEstimator {

    public static int estimateMinutes(String text) {
        if (text == null || text.isBlank()) {
            return 15;
        }

        int words = text.trim().split("\\s+").length;
        String lower = text.toLowerCase();

        int minutes = Math.max(10, (int) Math.round((words / 180.0) * 90));

        if (lower.contains("essay") || lower.contains("reflection")) {
            minutes += 25;
        }

        if (lower.contains("quiz") || lower.contains("multiple choice")) {
            minutes -= 10;
        }

        return Math.max(5, minutes);
    }

    public static String formatDuration(int totalMinutes) {
        int hours = totalMinutes / 60;
        int minutes = totalMinutes % 60;

        if (hours == 0) {
            return minutes + " minutes";
        }
        if (minutes == 0) {
            return hours + " hours";
        }
        return hours + " hours " + minutes + " minutes";
    }
}
