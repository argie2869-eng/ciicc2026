public class Task8 {

    public static int sum(int... numbers) {
        int total = 0;
        int cumulativeSum = 0;

        for (int i = 0; i < numbers.length; i++) {
            total += numbers[i];

            for (int j = 1; j <= numbers[i]; j++) {
                cumulativeSum += j;
            }

            System.out.println("Parameter " + numbers[i] +
                    " = " + cumulativeSum);
        }

        return total;
    }

    public static void main(String[] args) {

        int result = sum(4, 5, 10);

        System.out.println("Total Sum: " + result);
    }
}